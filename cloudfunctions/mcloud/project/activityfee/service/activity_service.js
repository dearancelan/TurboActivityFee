/**
 * Notes: 活动模块业务逻辑
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-06-23 07:48:00 
 */

const BaseProjectService = require('./base_project_service.js');
const util = require('../../../framework/utils/util.js');

const dataUtil = require('../../../framework/utils/data_util.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const ActivityModel = require('../model/activity_model.js');
const UserModel = require('../model/user_model.js');
const ActivityJoinModel = require('../model/activity_join_model.js');

const PayService = require('../service/pay_service.js');
const PayModel = require('../model/pay_model.js');

class ActivityService extends BaseProjectService {

	async minuteJob() {
		console.log('### minuteJob >>>>>');


		// 未支付的成功订单取消  
		let time = this._timestamp - 6 * 60 * 1000;
		console.log('###### Begin>>> 未支付订单6分钟后取消, time<=' + time + ', ' + timeUtil.timestamp2Time(time));


		let where = {
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]],
			ACTIVITY_JOIN_PAY_STATUS: 0,
			ACTIVITY_JOIN_ADD_TIME: ['<=', time],
		}
		let rows = await ActivityJoinModel.getAll(where, '*', {}, 3000, false);
		console.log('未支付订单6分钟后取消， count=', rows.length);

		for (let k in rows) {
			let activityJoin = rows[k];

			let tradeNo = activityJoin.ACTIVITY_JOIN_PAY_TRADE_NO;

			if (!await this.fixActivityJoinPay(tradeNo, activityJoin.ACTIVITY_JOIN_ACTIVITY_ID)) {
				console.log('该报名记录未支付，已取消并删除！', activityJoin);
			}

		}

		console.log('###### END. 未支付订单6分钟后取消');

	}

	// 获取当前活动状态
	getJoinStatusDesc(activity) {
		let timestamp = this._timestamp;

		if (activity.ACTIVITY_STATUS == 0)
			return '活动停止';
		else if (activity.ACTIVITY_END <= timestamp)
			return '活动结束';
		else if (activity.ACTIVITY_STOP <= timestamp)
			return '报名结束';
		else if (activity.ACTIVITY_MAX_CNT > 0
			&& activity.ACTIVITY_JOIN_CNT >= activity.ACTIVITY_MAX_CNT)
			return '报名已满';
		else
			return '报名中';
	}

	/** 浏览信息 */
	async viewActivity(userId, id) {

		await this.fixUserActivityJoinPayRecord(userId);

		let fields = '*';

		let where = {
			_id: id,
			ACTIVITY_STATUS: ActivityModel.STATUS.COMM
		}
		let activity = await ActivityModel.getOne(where, fields);
		if (!activity) return null;

		ActivityModel.inc(id, 'ACTIVITY_VIEW_CNT', 1);

		// 判断是否有报名
		let whereJoin = {
			ACTIVITY_JOIN_USER_ID: userId,
			ACTIVITY_JOIN_ACTIVITY_ID: id,
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]]
		}
		let activityJoin = await ActivityJoinModel.getOne(whereJoin);
		if (activityJoin) {
			activity.myActivityJoinId = activityJoin._id;
			activity.myActivityJoinTag = (activityJoin.ACTIVITY_JOIN_STATUS == ActivityJoinModel.STATUS.WAIT) ? '待审核' : '已报名';
			if (activity.myActivityJoinTag == '已报名' && activityJoin.ACTIVITY_JOIN_PAY_STATUS == 1) {
				activity.myActivityJoinTag = '已报名缴费';
			}
		}
		else {
			activity.myActivityJoinId = '';
			activity.myActivityJoinTag = '';
		}


		return activity;
	}

	/** 取得分页列表 */
	async getActivityList({
		cateId, //分类查询条件
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序 
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'ACTIVITY_ORDER': 'asc',
			'ACTIVITY_ADD_TIME': 'desc'
		};
		let fields = 'ACTIVITY_START_MONTH,ACTIVITY_END_MONTH,ACTIVITY_START_DAY,ACTIVITY_END_DAY,ACTIVITY_USER_LIST,ACTIVITY_STOP,ACTIVITY_JOIN_CNT,ACTIVITY_OBJ,ACTIVITY_VIEW_CNT,ACTIVITY_TITLE,ACTIVITY_MAX_CNT,ACTIVITY_START,ACTIVITY_END,ACTIVITY_ORDER,ACTIVITY_STATUS,ACTIVITY_CATE_NAME,ACTIVITY_OBJ';

		let where = {};
		where.and = {
			_pid: this.getProjectId() //复杂的查询在此处标注PID
		};
		if (cateId && cateId !== '0') where.and.ACTIVITY_CATE_ID = cateId;

		where.and.ACTIVITY_STATUS = ActivityModel.STATUS.COMM; // 状态  


		if (util.isDefined(search) && search) {
			where.or = [{
				ACTIVITY_TITLE: ['like', search]
			},];
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'cateId': {
					if (sortVal) where.and.ACTIVITY_CATE_ID = String(sortVal);
					break;
				}
				case 'sort': {
					// 排序
					orderBy = this.fmtOrderBySort(sortVal, 'ACTIVITY_ADD_TIME');
					break;
				}
				case 'today': { //今天
					let time = timeUtil.time('Y-M-D');
					where.and.ACTIVITY_START_DAY = ['<=', time];
					where.and.ACTIVITY_END_DAY = ['>=', time];
					break;
				}
				case 'tomorrow': { //明日
					let time = timeUtil.time('Y-M-D', 86400);
					where.and.ACTIVITY_START_DAY = ['<=', time];
					where.and.ACTIVITY_END_DAY = ['>=', time];
					break;
				}
				case 'month': { //本月
					let month = timeUtil.time('Y-M');
					where.and.ACTIVITY_START_MONTH = ['<=', month];
					where.and.ACTIVITY_END_MONTH = ['>=', month];
					break;
				}
			}
		}

		return await ActivityModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}


	/** 取得某一个报名分页列表 */
	async getActivityJoinList(activityId, {
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序 
		page,
		size,
		isTotal = true,
		oldTotal
	}) {
		orderBy = orderBy || {
			'ACTIVITY_JOIN_ADD_TIME': 'desc'
		};
		let fields = 'ACTIVITY_JOIN_OBJ,ACTIVITY_JOIN_IS_CHECKIN,ACTIVITY_JOIN_REASON,ACTIVITY_JOIN_ACTIVITY_ID,ACTIVITY_JOIN_STATUS,ACTIVITY_JOIN_ADD_TIME,user.USER_PIC,user.USER_NAME,user.USER_OBJ';

		let where = {
			ACTIVITY_JOIN_ACTIVITY_ID: activityId,
			ACTIVITY_JOIN_STATUS: ActivityModel.STATUS.COMM
		};

		let joinParams = {
			from: UserModel.CL,
			localField: 'ACTIVITY_JOIN_USER_ID',
			foreignField: 'USER_MINI_OPENID',
			as: 'user',
		};

		let result = await ActivityJoinModel.getListJoin(joinParams, where, fields, orderBy, page, size, isTotal, oldTotal);

		return result;
	}


	/** 取得我的报名分页列表 */
	async getMyActivityJoinList(userId, {
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序 
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		await this.fixUserActivityJoinPayRecord(userId);

		orderBy = orderBy || {
			'ACTIVITY_JOIN_ADD_TIME': 'desc'
		};
		let fields = 'ACTIVITY_JOIN_PAY_STATUS,ACTIVITY_JOIN_IS_CHECKIN,ACTIVITY_JOIN_REASON,ACTIVITY_JOIN_ACTIVITY_ID,ACTIVITY_JOIN_STATUS,ACTIVITY_JOIN_ADD_TIME,activity.ACTIVITY_END,activity.ACTIVITY_START,activity.ACTIVITY_TITLE';

		let where = {
			ACTIVITY_JOIN_USER_ID: userId
		};

		if (util.isDefined(search) && search) {
			where['activity.ACTIVITY_TITLE'] = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType) {
			// 搜索菜单
			switch (sortType) {
				case 'timedesc': { //按时间倒序
					orderBy = {
						'activity.ACTIVITY_START': 'desc',
						'ACTIVITY_JOIN_ADD_TIME': 'desc'
					};
					break;
				}
				case 'timeasc': { //按时间正序
					orderBy = {
						'activity.ACTIVITY_START': 'asc',
						'ACTIVITY_JOIN_ADD_TIME': 'asc'
					};
					break;
				}
				case 'succ': {
					where.ACTIVITY_JOIN_STATUS = ActivityJoinModel.STATUS.SUCC;
					break;
				}
				case 'wait': {
					where.ACTIVITY_JOIN_STATUS = ActivityJoinModel.STATUS.WAIT;
					break;
				}
				case 'usercancel': {
					where.ACTIVITY_JOIN_STATUS = ActivityJoinModel.STATUS.CANCEL;
					break;
				}
				case 'cancel': {
					where.ACTIVITY_JOIN_STATUS = ActivityJoinModel.STATUS.ADMIN_CANCEL;
					break;
				}
			}
		}

		let joinParams = {
			from: ActivityModel.CL,
			localField: 'ACTIVITY_JOIN_ACTIVITY_ID',
			foreignField: '_id',
			as: 'activity',
		};

		let result = await ActivityJoinModel.getListJoin(joinParams, where, fields, orderBy, page, size, isTotal, oldTotal);

		return result;
	}

	/** 取得我的报名详情 */
	async getMyActivityJoinDetail(userId, activityJoinId) {

		let fields = '*';

		let where = {
			_id: activityJoinId,
			ACTIVITY_JOIN_USER_ID: userId
		};
		let activityJoin = await ActivityJoinModel.getOne(where, fields);
		if (activityJoin) {
			activityJoin.activity = await ActivityModel.getOne(activityJoin.ACTIVITY_JOIN_ACTIVITY_ID, 'ACTIVITY_TITLE,ACTIVITY_START,ACTIVITY_END');
		}
		return activityJoin;
	}

	// 修正某用户所有未支付的成功订单状态，无须支付的不用处理
	async fixUserActivityJoinPayRecord(userId) {
		let where = {
			ACTIVITY_JOIN_USER_ID: userId,
			ACTIVITY_JOIN_PAY_STATUS: 0,
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]],
		}
		let list = await ActivityJoinModel.getAll(where);

		for (let k = 0; k < list.length; k++) {
			await this.fixActivityJoinPay(list[k].ACTIVITY_JOIN_PAY_TRADE_NO, list[k].ACTIVITY_JOIN_ACTIVITY_ID);
		}
	}

	// 修正某订单状态 （仅需支付订单）
	async fixActivityJoinPay(tradeNo, activityId) {

		if (!tradeNo) {
			// 无支付号空单 删除
			await ActivityJoinModel.del({ ACTIVITY_JOIN_PAY_TRADE_NO: tradeNo });

			// 重新统计
			this.statActivityJoin(activityId);

			return false;
		}

		let payService = new PayService();
		if (!await payService.fixPayResult(tradeNo)) {
			// 关闭未支付单
			payService.closePay(tradeNo);

			// 未支付 
			await ActivityJoinModel.del({ ACTIVITY_JOIN_PAY_TRADE_NO: tradeNo });

			// 重新统计
			this.statActivityJoin(activityId);

			return false;
		}

		// 已支付
		let pay = await PayModel.getOne({ PAY_TRADE_NO: tradeNo });
		if (!pay) this.AppError('支付流水异常，请核查');

		// 更新支付信息
		let data = {
			ACTIVITY_JOIN_PAY_STATUS: 1,
			ACTIVITY_JOIN_PAY_TRADE_NO: tradeNo,
			ACTIVITY_JOIN_PAY_FEE: pay.PAY_TOTAL_FEE,
			ACTIVITY_JOIN_PAY_TIME: pay.PAY_END_TIME,
		}
		await ActivityJoinModel.edit({ ACTIVITY_JOIN_PAY_TRADE_NO: tradeNo }, data);


		// 重新统计
		this.statActivityJoin(activityId);
		return true;
	}

	//################## 报名 
	// 报名 
	async prepay(userId, activityId, forms) {
		this.AppError('[报名缴费]该功能暂不开放，如有需要请加作者微信：cclinux0730');

	}


	async statActivityJoin(activityId) {
		// 报名数
		let where = {
			ACTIVITY_JOIN_ACTIVITY_ID: activityId,
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]]
		}
		let cnt = await ActivityJoinModel.count(where);


		// 已支付记录
		let wherePayCnt = {
			ACTIVITY_JOIN_ACTIVITY_ID: activityId,
			ACTIVITY_JOIN_PAY_STATUS: 1,
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]]
		}
		let payCnt = await ActivityJoinModel.count(wherePayCnt);


		// 已支付金额
		let wherePayFee = {
			ACTIVITY_JOIN_ACTIVITY_ID: activityId,
			ACTIVITY_JOIN_PAY_STATUS: 1,
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]]
		}
		let payFee = await ActivityJoinModel.sum(wherePayFee, 'ACTIVITY_JOIN_PAY_FEE');


		// 报名用户头像列表
		let whereUserList = {
			ACTIVITY_JOIN_ACTIVITY_ID: activityId,
			ACTIVITY_JOIN_STATUS: ActivityJoinModel.STATUS.SUCC,
			ACTIVITY_JOIN_PAY_STATUS: ['in', [1, 99]]
		}
		let joinParams = {
			from: UserModel.CL,
			localField: 'ACTIVITY_JOIN_USER_ID',
			foreignField: 'USER_MINI_OPENID',
			as: 'user',
		};
		let orderBy = {
			ACTIVITY_JOIN_ADD_TIME: 'desc'
		}
		let userList = await ActivityJoinModel.getListJoin(joinParams, whereUserList, 'ACTIVITY_JOIN_ADD_TIME,user.USER_MINI_OPENID,user.USER_NAME,user.USER_PIC', orderBy, 1, 6, false, 0);
		userList = userList.list;

		for (let k = 0; k < userList.length; k++) {
			userList[k] = userList[k].user;
		}

		let data = {
			ACTIVITY_JOIN_CNT: cnt,
			ACTIVITY_PAY_CNT: payCnt,
			ACTIVITY_PAY_FEE: payFee,

			ACTIVITY_USER_LIST: userList
		}
		await ActivityModel.edit(activityId, data);
	}

	/**  报名前获取关键信息 */
	async detailForActivityJoin(userId, activityId) {

		await this.fixUserActivityJoinPayRecord(userId);

		let fields = 'ACTIVITY_JOIN_FORMS, ACTIVITY_TITLE, ACTIVITY_FEE, ACTIVITY_METHOD';

		let where = {
			_id: activityId,
			ACTIVITY_STATUS: ActivityModel.STATUS.COMM
		}
		let activity = await ActivityModel.getOne(where, fields);
		if (!activity)
			this.AppError('该活动不存在');

		let whereMy = {
			ACTIVITY_JOIN_USER_ID: userId,
		}
		let orderByMy = {
			ACTIVITY_JOIN_ADD_TIME: 'desc'
		}

		//***取得本人所有记录
		let joinList = await ActivityJoinModel.getAll(whereMy, 'ACTIVITY_JOIN_OBJ,ACTIVITY_JOIN_FORMS', orderByMy);
		let addressList = [];
		let addressList2 = [];
		for (let k = 0; k < joinList.length; k++) {
			let exist = false;
			for (let j = 0; j < addressList.length; j++) {
				if (addressList[j].name === joinList[k].ACTIVITY_JOIN_OBJ.name) {
					exist = true;
					break;
				}
			}

			if (!exist) {
				addressList.push(joinList[k].ACTIVITY_JOIN_OBJ);
				addressList2.push(joinList[k].ACTIVITY_JOIN_FORMS);
			}
		}

		// 取出本人最近一次的填写表单
		let joinMy = await ActivityJoinModel.getOne(whereMy, 'ACTIVITY_JOIN_FORMS', orderByMy);
		joinMy = null;

		let myForms = joinMy ? joinMy.ACTIVITY_JOIN_FORMS : [];
		activity.myForms = myForms;

		activity.addressList = addressList;
		activity.addressList2 = addressList2;

		activity.ACTIVITY_FEE = Number(dataUtil.fmtMoney(activity.ACTIVITY_FEE / 100));

		return activity;
	}

	/** 取消我的报名 只有成功和待审核可以取消   */
	async cancelMyActivityJoin(userId, activityJoinId) {
		let where = {
			_id: activityJoinId,
			ACTIVITY_JOIN_USER_ID: userId,
			ACTIVITY_JOIN_STATUS: ['in', [ActivityJoinModel.STATUS.WAIT, ActivityJoinModel.STATUS.SUCC]] //只有成功和待审核可以取消
		};
		let activityJoin = await ActivityJoinModel.getOne(where);

		if (!activityJoin) {
			this.AppError('未找到可取消的报名记录');
		}

		if (activityJoin.ACTIVITY_JOIN_IS_CHECKIN == 1)
			this.AppError('该活动已经签到，无法取消报名');

		let activity = await ActivityModel.getOne(activityJoin.ACTIVITY_JOIN_ACTIVITY_ID);
		if (!activity)
			this.AppError('该活动不存在');

		if (activity.ACTIVITY_END <= this._timestamp)
			this.AppError('该活动已经结束，无法取消');

		if (activity.ACTIVITY_CANCEL_SET == 0)
			this.AppError('该活动不能取消报名');

		if (activity.ACTIVITY_CANCEL_SET == 2 && activity.ACTIVITY_STOP < this._timestamp)
			this.AppError('该活动已经截止报名，不能取消');

		if (activityJoin.ACTIVITY_JOIN_PAY_STATUS == 99) {
			// 无须支付
			// 更新记录 
			let data = {
				ACTIVITY_JOIN_STATUS: ActivityJoinModel.STATUS.CANCEL,
				ACTIVITY_JOIN_CANCEL_TIME: this._timestamp,
			}
			await ActivityJoinModel.edit(activityJoinId, data);
		}
		else {
			let tradeNo = activityJoin.ACTIVITY_JOIN_PAY_TRADE_NO;
			if (!await this.fixActivityJoinPay(tradeNo, activityJoin.ACTIVITY_JOIN_ACTIVITY_ID)) {
				this.AppError('该报名记录未支付，已取消并删除！');
			}
			let payService = new PayService();
			await payService.refundPay(tradeNo, '用户取消报名');

			// 更新记录 
			let data = {
				ACTIVITY_JOIN_STATUS: ActivityJoinModel.STATUS.CANCEL,
				ACTIVITY_JOIN_CANCEL_TIME: this._timestamp,
				ACTIVITY_JOIN_PAY_STATUS: 8,
			}
			await ActivityJoinModel.edit(activityJoinId, data);
		}


		// 统计
		await this.statActivityJoin(activityJoin.ACTIVITY_JOIN_ACTIVITY_ID);
	}


	/** 用户自助签到 */
	async myJoinSelf(userId, activityId) {
		let activity = await ActivityModel.getOne(activityId);
		if (!activity)
			this.AppError('活动不存在或者已经关闭');

		let day = timeUtil.timestamp2Time(activity.ACTIVITY_START, 'Y-M-D');

		let today = timeUtil.time('Y-M-D');
		if (day != today)
			this.AppError('仅在活动当天可以签到，当前签到码的日期是' + day);

		let whereSucc = {
			ACTIVITY_JOIN_USER_ID: userId,
			ACTIVITY_JOIN_STATUS: ActivityJoinModel.STATUS.SUCC
		}
		let cntSucc = await ActivityJoinModel.count(whereSucc);

		let whereCheckin = {
			ACTIVITY_JOIN_USER_ID: userId,
			ACTIVITY_JOIN_IS_CHECKIN: 1,
			ACTIVITY_JOIN_STATUS: ActivityJoinModel.STATUS.SUCC
		}
		let cntCheckin = await ActivityJoinModel.count(whereCheckin);

		let ret = '';
		if (cntSucc == 0) {
			ret = '您没有本次活动报名成功的记录，请在「个人中心 - 我的活动报名」查看详情~';
		} else if (cntSucc == cntCheckin) {
			// 同一活动多次报名的情况
			ret = '您已签到，无须重复签到，请在「个人中心 - 我的活动报名」查看详情~';
		} else {
			let where = {
				ACTIVITY_JOIN_USER_ID: userId,
				ACTIVITY_JOIN_IS_CHECKIN: 0,
				ACTIVITY_JOIN_STATUS: ActivityJoinModel.STATUS.SUCC
			}
			let data = {
				ACTIVITY_JOIN_IS_CHECKIN: 1,
				ACTIVITY_JOIN_CHECKIN_TIME: this._timestamp,
			}
			await ActivityJoinModel.edit(where, data);
			ret = '签到成功，请在「个人中心 - 我的活动报名」查看详情~'
		}
		return {
			ret
		};
	}

	/** 按天获取报名项目 */
	async getActivityListByDay(day) {
		let start = timeUtil.time2Timestamp(day);
		let end = start + 86400 * 1000 - 1;
		let where = {
			ACTIVITY_STATUS: ActivityModel.STATUS.COMM,
			ACTIVITY_START: ['between', start, end],
		};

		let orderBy = {
			'ACTIVITY_ORDER': 'asc',
			'ACTIVITY_ADD_TIME': 'desc'
		};

		let fields = 'ACTIVITY_TITLE,ACTIVITY_START,ACTIVITY_OBJ.cover';

		let list = await ActivityModel.getAll(where, fields, orderBy);

		let retList = [];

		for (let k = 0; k < list.length; k++) {

			let node = {};
			node.timeDesc = timeUtil.timestamp2Time(list[k].ACTIVITY_START, 'h:m');
			node.title = list[k].ACTIVITY_TITLE;
			node.pic = list[k].ACTIVITY_OBJ.cover[0];
			node._id = list[k]._id;
			retList.push(node);

		}
		return retList;
	}

	/**
	 * 获取从某天开始可报名的日期
	 * @param {*} fromDay  日期 Y-M-D
	 */
	async getActivityHasDaysFromDay(fromDay) {
		let where = {
			ACTIVITY_START: ['>=', timeUtil.time2Timestamp(fromDay)],
		};

		let fields = 'ACTIVITY_START';
		let list = await ActivityModel.getAllBig(where, fields);

		let retList = [];
		for (let k = 0; k < list.length; k++) {
			let day = timeUtil.timestamp2Time(list[k].ACTIVITY_START, 'Y-M-D');
			if (!retList.includes(day)) retList.push(day);
		}
		return retList;
	}


}

module.exports = ActivityService;