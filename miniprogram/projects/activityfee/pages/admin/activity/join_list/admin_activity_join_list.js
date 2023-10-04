const AdminBiz = require('../../../../../../comm/biz/admin_biz.js');
const pageHelper = require('../../../../../../helper/page_helper.js');
const timeHelper = require('../../../../../../helper/time_helper.js');
const cacheHelper = require('../../../../../../helper/cache_helper.js');
const helper = require('../../../../../../helper/helper.js');
const cloudHelper = require('../../../../../../helper/cloud_helper.js');

const CACHE_CANCEL_REASON = 'ACTIVITY_JOIN_CANCEL_REASON';

Page({

    /**
     * 页面的初始数据
     */
    data: {
        isLoad: false,
        isAllFold: true,

        parentDayIdx: 0,
        parentTimeIdx: 0,

        menuIdx: 0,

        activityId: '',

        title: '',
        titleEn: '',

        cancelModalShow: false,
        cancelAllModalShow: false,
        formReason: '',
        curIdx: -1
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        if (!AdminBiz.isAdmin(this)) return;

        // 附加参数 
        if (options && options.activityId) {
            //设置搜索菜单 
            this._getSearchMenu();

            this.setData({
                activityId: options.activityId,
                _params: {
                    activityId: options.activityId
                }
            }, () => {
                this.setData({
                    isLoad: true
                });
            });
        }

        if (options && options.title) {
            let title = decodeURIComponent(options.title);
            this.setData({
                title,
                titleEn: options.title
            });
            wx.setNavigationBarTitle({
                title: '活动名单 - ' + title
            });
        }
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {

    },

    url: async function (e) {
        pageHelper.url(e, this);
    },

    bindUnFoldTap: function (e) {
        let idx = pageHelper.dataset(e, 'idx');
        let dataList = this.data.dataList;
        dataList.list[idx].fold = false;
        this.setData({
            dataList
        });
    },

    bindFoldTap: function (e) {
        let idx = pageHelper.dataset(e, 'idx');
        let dataList = this.data.dataList;
        dataList.list[idx].fold = true;
        this.setData({
            dataList
        });
    },

    bindFoldAllTap: function (e) {
        let dataList = this.data.dataList;
        for (let k = 0; k < dataList.list.length; k++) {
            dataList.list[k].fold = true;
        }
        this.setData({
            isAllFold: true,
            dataList
        });
    },

    bindUnFoldAllTap: function (e) {
        let dataList = this.data.dataList;
        for (let k = 0; k < dataList.list.length; k++) {
            dataList.list[k].fold = false;
        }
        this.setData({
            isAllFold: false,
            dataList
        });
    },

    bindCopyTap: function (e) {
        let idx = pageHelper.dataset(e, 'idx');
        let forms = this.data.dataList.list[idx].ACTIVITY_JOIN_FORMS;

        let ret = '';

        if (this.data.title)
            ret += `活动：${this.data.title}\r`;

        for (let k = 0; k < forms.length; k++) {
            ret += forms[k].title + '：' + forms[k].val + '\r';
        }
        wx.setClipboardData({
            data: ret,
            success(res) {
                wx.getClipboardData({
                    success(res) {
                        pageHelper.showSuccToast('已复制到剪贴板');
                    }
                })
            }
        });

    },

    bindCancelTap: function (e) {
        this.setData({
            formReason: cacheHelper.get(CACHE_CANCEL_REASON) || '',
            curIdx: Number(pageHelper.dataset(e, 'idx')),
            cancelModalShow: true
        });
    },

    bindCheckinTap: async function (e) {
        let flag = Number(pageHelper.dataset(e, 'flag'));

        let callback = async () => {
            let idx = Number(pageHelper.dataset(e, 'idx'));
            let dataList = this.data.dataList;
            let activityJoinId = dataList.list[idx]._id;
            let params = {
                activityJoinId,
                flag,
            }
            let opts = {
                title: '处理中'
            }
            try {
                await cloudHelper.callCloudSumbit('admin/activity_join_checkin', params, opts).then(res => {
                    let cb = () => {
                        let sortIndex = this.selectComponent('#cmpt-comm-list').getSortIndex();
                        if (sortIndex >= 8 && !this.data.search) { // 全部或者检索的结果
                            dataList.list.splice(idx, 1);
                            dataList.total--;
                        } else {
                            dataList.list[idx].ACTIVITY_JOIN_IS_CHECKIN = flag;
                        }
                        this.setData({
                            dataList
                        });
                    }

                    pageHelper.showSuccToast('操作成功', 1000, cb);


                });
            } catch (err) {
                console.error(err);
            }
        }
        if (flag == 1)
            pageHelper.showConfirm('确认「签到核销」？', callback);
        else if (flag == 0)
            pageHelper.showConfirm('确认「取消签到」？', callback);

    },

    bindCancelCmpt: async function (e) {

        let callback = async () => {
            let idx = this.data.curIdx;
            let dataList = this.data.dataList;
            let activityJoinId = dataList.list[idx]._id;
            let reason = this.data.formReason;

            let params = {
                activityJoinId,
                reason
            }
            let opts = {
                title: '取消中'
            }
            try {
                await cloudHelper.callCloudSumbit('admin/activity_join_cancel', params, opts).then(res => {

                    cacheHelper.set(CACHE_CANCEL_REASON, reason, 86400 * 365);

                    let cb = () => {
                        // 更新列表页面数据
                        this.setData({
                            ['dataList.list[' + idx + '].ACTIVITY_JOIN_REASON']: reason,
                            ['dataList.list[' + idx + '].ACTIVITY_JOIN_STATUS']: 99,
                            ['dataList.list[' + idx + '].ACTIVITY_JOIN_CANCEL_TIME']: timeHelper.time('Y-M-D h:m:s'),

                            curIdx: -1,
                            cancelModalShow: false
                        });
                    }

                    pageHelper.showModal('取消成功 (若有在线缴费，所缴纳费用将在1-5分钟内原路退还)', '温馨提示', cb); 
                });
            } catch (err) {
                console.error(err);
            }
        }

        pageHelper.showConfirm('确认取消该报名记录？ 取消后不可恢复', callback);


    },

    bindPassTap: async function (e) {

        let callback = async () => {
            let idx = Number(pageHelper.dataset(e, 'idx'));
            let dataList = this.data.dataList;
            let activityJoinId = dataList.list[idx]._id;
            let params = {
                activityJoinId,
            }
            let opts = {
                title: '处理中'
            }
            try {
                await cloudHelper.callCloudSumbit('admin/activity_join_pass', params, opts).then(res => {

                    this.setData({
                        ['dataList.list[' + idx + '].ACTIVITY_JOIN_REASON']: '',
                        ['dataList.list[' + idx + '].ACTIVITY_JOIN_STATUS']: 1,
                        ['dataList.list[' + idx + '].ACTIVITY_JOIN_IS_CHECKIN']: 0,
                    });

                    pageHelper.showSuccToast('审核通过', 1000);
                });
            } catch (err) {
                console.error(err);
            }
        }

        pageHelper.showConfirm('确认审核通过？', callback);

    },

    bindCommListCmpt: function (e) {

        if (helper.isDefined(e.detail.search))
            this.setData({
                search: '',
                sortType: '',
            });
        else {
            let dataList = e.detail.dataList;
            if (dataList) {
                for (let k = 0; k < dataList.list.length; k++) {
                    dataList.list[k].fold = this.data.isAllFold;
                }
            }

            this.setData({
                dataList,
            });
            if (e.detail.sortType)
                this.setData({
                    sortType: e.detail.sortType,
                });
        }

    },

    // 修改与展示状态菜单
    _getSearchMenu: function () {

        let sortItems = [];
        let sortMenus = [
            { label: '全部', type: '', value: '' },
            { label: `待审核`, type: 'status', value: 0 },
            { label: `报名成功`, type: 'status', value: 1 },
            { label: `用户取消`, type: 'status', value: 98 },
            { label: `未过审/系统取消`, type: 'status', value: 99 },
            { label: `已签到`, type: 'checkin', value: 1 },
            { label: `未签到`, type: 'checkin', value: 0 }
        ];
        this.setData({
            sortItems,
            sortMenus
        })


    },

    bindClearReasonTap: function (e) {
        this.setData({
            formReason: ''
        })
    }
})