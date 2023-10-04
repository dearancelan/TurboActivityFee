/**
 * Notes: 全局/首页模块业务逻辑
 * Date: 2021-03-15 04:00:00 
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 */

const BaseProjectService = require('./base_project_service.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const setupUtil = require('../../../framework/utils/setup/setup_util.js');
const ActivityModel = require('../model/activity_model.js');

class HomeService extends BaseProjectService {

	async getSetup(key) {
		return await setupUtil.get(key);
	}

	/**首页列表 */
	async getHomeList() {
		let fields = 'ACTIVITY_START_DAY,ACTIVITY_END_DAY,ACTIVITY_START,ACTIVITY_TITLE,ACTIVITY_CATE_NAME,ACTIVITY_JOIN_CNT,ACTIVITY_USER_LIST,ACTIVITY_OBJ.cover,ACTIVITY_OBJ.vouch';
		let where = {
			ACTIVITY_STATUS: 1
		}
		let newList = await ActivityModel.getAll(where, fields, { 'ACTIVITY_ADD_TIME': 'desc' }, 10);
		for (let k = 0; k < newList.length; k++) { 

			if (newList[k].ACTIVITY_START_DAY == newList[k].ACTIVITY_END_DAY) {
				newList[k].time = newList[k].ACTIVITY_START_DAY + ' ' + timeUtil.week(newList[k].ACTIVITY_START_DAY);
			}
			else {
				newList[k].time = newList[k].ACTIVITY_START_DAY + ' ~ ' + newList[k].ACTIVITY_END_DAY;
			} 

		}

		let vouchList = await ActivityModel.getAll(where, fields, { 'ACTIVITY_VOUCH': 'desc', 'ACTIVITY_ADD_TIME': 'desc' }, 10);

		let hotList = await ActivityModel.getAll(where, fields, { 'ACTIVITY_JOIN_CNT': 'desc', 'ACTIVITY_ADD_TIME': 'desc' }, 10);
		for (let k = 0; k < hotList.length; k++) {
			if (hotList[k].ACTIVITY_START_DAY == hotList[k].ACTIVITY_END_DAY) {
				hotList[k].time = hotList[k].ACTIVITY_START_DAY + ' ' + timeUtil.week(hotList[k].ACTIVITY_START_DAY);
			}
			else {
				hotList[k].time = hotList[k].ACTIVITY_START_DAY + ' ~ ' + hotList[k].ACTIVITY_END_DAY;
			} 
		}

		return { newList, hotList, vouchList }

	}
}

module.exports = HomeService;