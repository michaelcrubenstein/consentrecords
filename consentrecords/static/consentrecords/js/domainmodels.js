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
		addValue : "/local/addvalue/",
		updateValues : "/local/updatevalues/",
		deleteValue : '/local/deletevalue/',
		deleteInstances : '/local/deleteinstances/',
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignout : '/user/submitsignout/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
	};
	
