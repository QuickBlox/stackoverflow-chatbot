import QB from 'quickblox';
import QBChat from './QBChat';
import CONFIG from '../../config';

export default class QBDialog {
    constructor() {
        this.userId = CONFIG.quickblox.bot.id;
        this.userDialogsAssotiation = {};
        this.recipientJid = {};
    }

    list(skip) {
        QB.chat.dialog.list({
            'sort_desc': 'last_message_date_sent',
            'skip': skip || 0
        }, (error, result) => {
            if (error) {
                return false;
            } else {
                let totalEntries = result.total_entries,
                    localEntries = result.limit + result.skip;

                result.items.forEach((item) => {
                    if (+item.type === 2) {
                        QB.chat.muc.join(item.xmpp_room_jid, () => {
                            this.setRecipientJid(item._id, item.xmpp_room_jid);
                        });
                    } else if (+item.type === 3) {
                        let id = QB.chat.helpers.getRecipientId(item.occupants_ids, this.userId);

                        this.setRecipientJid(item._id, id);
                        this.setUserDialogsAssotiation(id, item._id);
                    }
                });

                if (totalEntries > localEntries) {
                    this.list(localEntries);
                }
            }
        });
    }

    get(params) {
        return new Promise((resolve, reject) => {
            QB.chat.dialog.list(params, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res.items[0]);
                }
            });
        });
    }

    remove(params) {
        const _sayGoodbye = function(dialog) {
            return new Promise((resolve, reject) => {
                try {
                    if (+dialog.type === 2) {
                        QBChat.sendMessage({
                            to: this.getRecipientJid(dialog._id),
                            type: this.getTypeOfChat(dialog._id),
                            text: 'Notification message',
                            dialogId: dialog._id,
                            notification_type: '2',
                            current_occupant_ids: dialog.occupants_ids.join(),
                            deleted_occupant_ids: this.userId,
                            dialog_update_info: 3
                        });
                    } else if (+dialog.type === 3) {
                        const id = QB.chat.helpers.getRecipientId(dialog.occupants_ids, this.userId);

                        QBChat.sendMessage({
                            to: this.getRecipientJid(dialog._id),
                            type: this.getTypeOfChat(dialog._id),
                            text: 'Contact request',
                            dialogId: dialog._id,
                            notification_type: '7'
                        });

                        this.deleteUserDialogsAssotiation(id);
                    }

                    this.deleteRecipientJid(dialog._id);

                    resolve(dialog._id);
                } catch (e) {
                    reject(e);
                }
            });
        };

        const _removeDialog = function(dialogId) {
            return new Promise((resolve, reject) => {
                QB.chat.dialog.delete(dialogId, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(dialogId);
                    }
                });
            });
        }

        return new Promise((resolve, reject) => {
            this.get(params)
                .then(result => { return _sayGoodbye.call(this, result); })
                .then(dialogId => { return _removeDialog(dialogId); })
                .then(dialogId => resolve(dialogId))
                .catch(error => reject(error));
        });
    }

    install(params) {
        this.get(params).then(
            result => sayHello.call(this, result)
        );

        function sayHello(dialog) {
            if (+dialog.type === 3) {
                const id = QB.chat.helpers.getRecipientId(dialog.occupants_ids, this.userId);
                this.setRecipientJid(dialog._id, id);

                QBChat.sendMessage({
                    to: this.getRecipientJid(dialog._id),
                    type: this.getTypeOfChat(dialog._id),
                    text: 'Contact request',
                    dialogId: dialog._id,
                    notification_type: '5'
                });

                QBChat.sendMessage({
                    to: this.getRecipientJid(dialog._id),
                    type: this.getTypeOfChat(dialog._id),
                    text: 'Hello! Use "@so /help" to get all commands list.',
                    dialogId: dialog._id
                });
            } else if (+dialog.type === 2) {
                this.setRecipientJid(dialog._id, dialog.xmpp_room_jid);

                QB.chat.muc.join(this.getRecipientJid(dialog._id), () => {
                    QBChat.sendMessage({
                        to: this.getRecipientJid(dialog._id),
                        type: this.getTypeOfChat(dialog._id),
                        text: 'Hello everybody! Use "@so /help" to get all commands list.',
                        dialogId: dialog._id
                    });
                });
            }
        }
    }

    setUserDialogsAssotiation(id, dialogId) {
        this.userDialogsAssotiation[id] = dialogId;
    }

    getUserDialogsAssotiation(id) {
        return this.userDialogsAssotiation[id];
    }

    deleteUserDialogsAssotiation(id) {
        delete this.userDialogsAssotiation[id];
    }

    setRecipientJid(dialogId, jidOrId) {
        switch (typeof jidOrId) {
            case 'number':
                this.recipientJid[dialogId] = {
                    jid: QB.chat.helpers.getUserJid(jidOrId, null),
                    type: 'chat'
                };
                break;

            case 'string':
                this.recipientJid[dialogId] = {
                    jid: jidOrId,
                    type: 'groupchat'
                };
                break;

            default:
                return false;
        }
    }

    getRecipientJid(dialogId) {
        return this.recipientJid[dialogId].jid;
    }

    getTypeOfChat(dialogId) {
        return this.recipientJid[dialogId].type;
    }

    deleteRecipientJid(dialogId) {
        delete this.recipientJid[dialogId];
    }
}