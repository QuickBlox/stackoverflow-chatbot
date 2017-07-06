'use strict';

const QB = require('quickblox');
const CONFIG = require('../../config');

module.exports = class QBData {
    constructor() {
        this.dataClassName = CONFIG.quickblox.dataClassName;
    }

    subscribe(params) {
        return new Promise((resolve, reject) => {
            if (!params.tag) {
                reject('Can\'t subscribe without tag name');
            }

            QB.data.create(this.dataClassName, params, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    unsubscribe(dialogId, params) {
        return new Promise((resolve, reject) => {
            if (dialogId && (params.toLowerCase() === 'all')) {
                this.getRecordsByDialogId(dialogId)
                    .then(records => {
                        let _ids = [];

                        records.forEach(record => {
                            _ids.push(record._id)
                        });

                        return this.removeRecords(_ids);
                    })
                    .then(result => resolve('Unsubscribed from all.'))
                    .catch(error => reject(error));
            } else {
                this.removeRecords(params)
                    .then(result => resolve(`Unsubscribed from tags with IDs: ${params}.`))
                    .catch(error => reject(error));
            }
        });
    }

    listRecords(params, items = [], skip = 0) {
        const limit = 1000;

        params.limit = limit;
        params.skip = skip;

        return new Promise((resolve, reject) => {
            QB.data.list(this.dataClassName, params, (err, res) => {
                if (res) {
                    let results = items.concat(res.items),
                        total = limit + skip;

                    if (results.length === total) {
                        this.listRecords(params, results, total)
                            .then(results => resolve(results))
                            .catch(error => reject(error));
                    } else {
                        resolve(results);
                    }
                } else {
                    reject(err);
                }
            });
        });
    }

    getRecordsByDialogId(dialogId) {
        return new Promise((resolve, reject) => {
            this.listRecords({dialogId: dialogId})
                .then(results => resolve(results))
                .catch(error => reject(error));
        });
    }

    getAllRecordsTags() {
        return new Promise((resolve, reject) => {
            this.listRecords({sort_asc: 'created_at'})
                .then(result => resolve(getUniqueTags(result)))
                .catch(error => reject(error));
        });

        function getUniqueTags(records) {
            let items = new Set();

            records.forEach((record) => {
                let item = record.tag;
                if (item && (typeof item === 'string')) {
                    items.add(item);
                }
            });

            return [...items];
        }
    }

    getRecordsByTag(tag) {
        return new Promise((resolve, reject) => {
            this.listRecords({tag: tag})
                .then(records => resolve(records))
                .catch(error => reject(error));
        });
    }

    removeRecords(params) {
        return new Promise((resolve, reject) => {
            QB.data.delete(this.dataClassName, params, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }
};

