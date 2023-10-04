module.exports = { //activityfee
	PROJECT_COLOR: '#0820a8',
	NAV_COLOR: '#ffffff',
	NAV_BG: '#0820a8',


	// setup
	SETUP_CONTENT_ITEMS: [
		{ title: '关于我们', key: 'SETUP_CONTENT_ABOUT' },
	],

	// 用户
	USER_REG_CHECK: false,
	USER_FIELDS: [
		{ mark: 'sex', title: '性别', type: 'select', selectOptions: ['男', '女'], must: true },
	],
	USER_CHECK_FORM: {
		name: 'formName|must|string|min:1|max:30|name=昵称',
		mobile: 'formMobile|must|mobile|name=手机',
		pic: 'formPic|must|string|name=头像',
		forms: 'formForms|array'
	},


	NEWS_NAME: '通知公告',
	NEWS_CATE: [
		{ id: 1, title: '通知公告', style: 'leftbig1' },

	],
	NEWS_FIELDS: [
	],

	ACTIVITY_NAME: '活动',
	ACTIVITY_CATE: [
		{ id: 1, title: '展览市集' },
		{ id: 2, title: '交友聚会' },
		{ id: 3, title: '运动健康' },
		{ id: 4, title: '休闲娱乐' },
		{ id: 5, title: '儿童亲子' }, 
		{ id: 6, title: '户外出游' },
		{ id: 7, title: '演出曲艺' },
		{ id: 8, title: '读书会' },
		{ id: 9, title: '公益活动' },
		{ id: 10, title: '学术讲座' },
		{ id: 11, title: '行业活动' },
		{ id: 12, title: '其他活动' },
	],
	ACTIVITY_FIELDS: [
		{ mark: 'time', title: '预计时长(小时)', type: 'digit', must: true }, 
		{ mark: 'desc', title: '活动内容', type: 'content', must: true }, 
		{ mark: 'cover', title: '封面图', type: 'image', min: 1, max: 1, must: true }, 
		{
			mark: 'flow', title: '活动流程', type: 'rows',
			ext: {
				titleName: '流程',
				hasDetail: false,
				hasVal: false,
				maxCnt: 30,
				minCnt: 1,
				checkDetail: true,
				hasPic: false,
				checkPic: false,
				titleMode: 'textarea'
			},
			def: [{ title: '14:00在指定地点集合' }, { title: '14:50相互认识了解下' }, { title: '15:00正式开始' }, { title: '16:30活动结束，后续自然结束活动，可自行组队约饭' }],
			must: true
		},
	],
	ACTIVITY_JOIN_FIELDS: [
		{ mark: 'name', type: 'text', title: '姓名', must: true, max: 30 },
		{ mark: 'phone', type: 'mobile', title: '手机', must: true, edit: false }
	],


	COMMENT_NAME: '评价',
	COMMENT_FIELDS: [
		{ mark: 'content', title: '评价内容', type: 'textarea', must: true },
		{ mark: 'img', title: '图片', type: 'image', min: 0, max: 8, must: false },

	],

}