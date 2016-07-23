/*
	domainmodels.js
	
	This file contains overrides to models.js which apply only to web pages that do not
	make crossDomain calls to the web server.
 */

cr.urls = {
		selectAll : "/local/selectall/",
		getValues : "/local/getvalues/",
		getUserID : "/local/getuserid/",
		getData : "/local/getdata/",
		getConfiguration : "/local/getconfiguration/",
		createInstance : "/local/createinstance/",
		updateValues : "/local/updatevalues/",
		deleteValue : '/local/deletevalue/',
		deleteInstances : '/local/deleteinstances/',
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignout : '/user/submitsignout/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
		updateUsername: '/user/updateusername/',
		updatePassword: '/user/updatepassword/',
		acceptFollower: '/user/acceptFollower/',
		requestAccess: '/user/requestAccess/',
		log: '/monitor/log/',
	};
	
