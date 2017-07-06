'use strict';

const QB = require('quickblox');
const QBDialog = require('./QBDialog.js');
const QBData = require('./QBData.js');
const CONFIG = require('../../config.js');

module.exports = class QBChat {
    constructor() {
        QB.init(
            CONFIG.quickblox.appId,
            CONFIG.quickblox.authKey,
            CONFIG.quickblox.authSecret,
            CONFIG.quickblox.config
        );

        this.user = {
            login: CONFIG.quickblox.bot.login,
            password: CONFIG.quickblox.bot.password,
            id: CONFIG.quickblox.bot.id
        };

        this.qbDialog = new QBDialog(QBChat.sendMessage);
        this.qbData = new QBData();
    }

    connect() {
        return new Promise((resolve, reject) => {
            QB.createSession({
                'login': this.user.login,
                'password': this.user.password
            }, (error, session) => {
                if (session) {
                    QB.chat.connect({
                        'userId': this.user.id,
                        'password': session.token
                    }, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                } else {
                    reject(error);
                }
            });
        });
    }

    qbListeners() {
        QB.chat.onMessageListener = this.onMessage.bind(this);
        QB.chat.onSystemMessageListener = this.onSystemMessage.bind(this);
        QB.chat.onSubscribeListener = this.onSubscribe.bind(this);
        QB.chat.onRejectSubscribeListener = this.onReject.bind(this);
    }

    static sendMessage(params) {
        const time = Math.floor(Date.now() / 1000);

        if (params.post) {
            params.text = `New activity: "${params.post.title}". ${params.post.link}`;
        }

        let msg = {
            'type': params.type,
            'body': params.text,
            'markable': 1,
            'extension': {
                'date_sent': time,
                'dialog_id': params.dialogId,
                'save_to_history': 1
            }
        };

        if (params.notification_type) {
            msg.extension.notification_type = params.notification_type
        }

        if (params.dialog_update_info === 3) {
            msg.extension.current_occupant_ids = params.current_occupant_ids;
            msg.extension.deleted_occupant_ids = params.deleted_occupant_ids;
            msg.extension.dialog_update_info = params.dialog_update_info;
            msg.extension.room_updated_date = time;

            delete msg.markable;
        }

        QB.chat.send(params.to, msg);
    }

    onMessage(id, msg) {
        if (id === this.user.id) {
            return false;
        }

        if ( (msg.type === 'chat') && (!this.qbDialog.setUserDialogsAssotiation(id)) ) {
            this.qbDialog.setUserDialogsAssotiation(id, msg.dialog_id);
        }

        if (msg.body.includes('@so ')) {
            const answer = this.answerManager(msg);

            switch (answer.items[1]) {
                case '/help':
                    answer.sendResponseToHelp();
                    break;

                case '/kick':
                    answer.sendResponseToKick();
                    break;

                case '/list':
                    answer.sendResponseToList();
                    break;

                case '/subscribe':
                    answer.sendResponseToSubscribe();
                    break;

                case '/unsubscribe':
                    answer.sendResponseToUnsubscribe();
                    break;

                default:
                    answer.sendDefaultResponse();
                    break;
            }
        }
    }

    onSystemMessage(msg) {
        const type = msg.extension && msg.extension.notification_type,
              dialogId = msg.extension && msg.extension.dialog_id;

        if (type !== '1') {
            return false;
        }

        this.qbDialog.install({'_id': dialogId});
    }

    onSubscribe(id) {
        QB.chat.roster.confirm(id, () => this.answerToContact(id, '5'));
    }

    onReject(id) {
        QB.chat.roster.reject(id, () => this.answerToContact(id, '7'));
    }

    answerToContact(id, type) {
        const dialogId = this.qbDialog.setUserDialogsAssotiation(id),
            params = dialogId ? {'_id': dialogId} : {
                'occupants_ids': { all: [id, this.user.id] },
                'type': 3
            };

        switch (type) {
            case '5':
                this.qbDialog.install(params);
                break;

            case '7':
                this.qbDialog.remove(params)
                    .then(dialogId => {
                        this.qbData.unsubscribe(dialogId, 'all')
                    });
                break;

            default:
                return false;
        }
    }

    answerManager(msg) {
        const self = this,
              items = msg.body.trim()
                            .toLowerCase()
                            .replace(/,/gi, ' ')
                            .replace(/ {1,}/g,' ')
                            .split(' ');

        return {
            items,

            sendResponse(text) {
                QBChat.sendMessage({
                    to: self.qbDialog.getRecipientJid(msg.dialog_id),
                    type: msg.type,
                    text: text,
                    dialogId: msg.dialog_id
                });
            },

            sendFailInfo(err) {
                let text = err;

                if (typeof err === 'object') {
                    text = JSON.stringify(err);
                }

                this.sendResponse(text);
            },

            sendDefaultResponse() {
                this.sendResponse(`I don\'t know what you want. Use "@so /help" to get all commands list.`);
            },

            sendResponseToList() {
                self.qbData.getRecordsByDialogId(msg.dialog_id).then(
                    results => sendAvailableRecords.call(this, results),
                    error => sendErrorInfo.call(this, error)
                );

                function sendAvailableRecords(records) {
                    if (!records.length) {
                        sendErrorInfo.call(this, {code: 404});
                        
                        return false;
                    }

                    let text = '';

                    records.forEach((item) => {
                        if (item.tag) {
                            text += `ID - ${item._id} \nSubscribed to "${item.tag}" \n`;
                        }

                        if (item.filters && item.filters.length) {
                            text += `Filters: ${item.filters.join(', ')}.\n \n`;
                        } else {
                            text += '\n';
                        }
                    });

                    this.sendResponse(text);
                }

                function sendErrorInfo(err) {
                    if (err.code === 404) {
                        this.sendResponse('Not subscribed.');
                    } else {
                        this.sendFailInfo(err);
                    }
                }
            },

            sendResponseToHelp() {
                let text = `Possible commands:
@so /help - all commands list;
@so /kick - kick bot from the current group chat;
@so /list - get current tags' list;
@so /subscribe <subscription> <...filters> - subscribe on main tag;
@so /unsubscribe <ID/IDs/all> - unsubscribe from tag by ID/IDs or from all.`;

                this.sendResponse(text);
            },

            sendResponseToKick() {
                if (msg.type === 'chat') {
                    this.sendResponse('Command "@so /kick" uses only in group chat');
                } else {
                    this.sendResponse('Goodbye! Have a good day!');

                    self.qbDialog.remove({'_id': msg.dialog_id})
                        .then(dialogId => {
                            self.qbData.unsubscribe(dialogId, 'all')
                        });
                }
            },

            sendResponseToSubscribe() {
                self.qbData.subscribe({
                    dialogId: msg.dialog_id,
                    tag: items[2],
                    filters: items.splice(3)
                }).then(record => {
                    let text = `ID - ${record._id} \nSubscribed to "${record.tag}"\n`;

                    if (record.filters && record.filters.length) {
                        text += `Filters: ${record.filters.join(', ')}.`;
                    }

                    this.sendResponse(text);
                }).catch(error => {
                    this.sendFailInfo(error);
                });
            },

            sendResponseToUnsubscribe() {
                self.qbData.unsubscribe(msg.dialog_id, items.slice(2).join(','))
                    .then(result => this.sendResponse(result))
                    .catch(error => this.sendFailInfo(error));
            }
        };
    }
};
