'use strict';

const stackexchange = require('stackexchange');
const cron = require('node-cron');
const CONFIG = require('../config');
const QBChat = require('./QB_modules/QBChat');

const stackoverflow = new stackexchange({version: 2.2});
const qbChat = new QBChat();
const qbData = qbChat.qbData;
const qbDialog = qbChat.qbDialog;

module.exports = class App {
    constructor() {
        qbChat.connect().then(result => {
            qbDialog.list();
            qbChat.qbListeners();

            cron.schedule(`*/${CONFIG.taskRepeatTime} * * * *`, () => {
                this.startTask();
            },  true);
        });
    }

    startTask() {
        qbData.getAllRecordsTags()
            .then(tags => {
                tags.forEach(tag => {
                    this.listPosts({tag: tag})
                        .then(posts => {
                            qbData.getRecordsByTag(tag)
                                .then(records => {
                                    this.notificateSubscribedDialogs(records, posts);
                                });
                        })
                        .catch(error => {
                            console.log('error: ', error);
                        });
                });
            })
            .catch(err => {
                console.log('err: ', err);
            });
    }

    listPosts(params = {}) {
        const time = Math.floor(Date.now() / 1000) - (CONFIG.taskRepeatTime * 60),
              results = params.posts || [];

        return new Promise((resolve, reject) => {
            let filters = {
                key: CONFIG.stackoverflow.key,
                page: params.page || 1,
                pagesize: CONFIG.stackoverflow.pagesize,
                fromdate: params.time || time,
                tagged: params.tag || 'javascript',
                sort: 'activity',
                order: 'desc'
            };

            stackoverflow.questions.questions(filters, (err, res) => {
                if (res) {
                    let posts = results.concat(res.items);

                    if (res.has_more) {
                        this.listPosts({
                            fromdate: filters.fromdate,
                            page: ++filters.page,
                            posts: posts
                        })
                            .then(result => resolve(result))
                            .catch(error => reject(error));
                    } else {
                        resolve(posts);
                    }
                } else {
                    reject(err);
                }
            });
        });
    }

    notificateSubscribedDialogs(records, posts) {
        records.forEach(record => {
            posts.forEach(post => {
                if (App.isFilteredAndValid(record.filters, post.tags)) {
                    QBChat.sendMessage({
                        to: qbDialog.getRecipientJid(record.dialogId),
                        type: qbDialog.getTypeOfChat(record.dialogId),
                        post: post,
                        dialogId: record.dialogId
                    });
                }
            });
        });
    }

    static isFilteredAndValid(filters, tags) {
        let result = !filters;

        if (!result) {
            top:
            for (let i = 0; i < filters.length; i++) {
                for (let j = 0; j < tags.length; j++) {
                    if (filters[i] === tags[j]) {
                        result = true;
                        break top;
                    }
                }
            }
        }

        return result;
    }
}
