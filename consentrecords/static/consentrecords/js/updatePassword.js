var UpdatePasswordPanel = (function () {
	UpdatePasswordPanel.prototype = Object.create(crv.SitePanel.prototype);
	UpdatePasswordPanel.prototype.constructor = UpdatePasswordPanel;

	function UpdatePasswordPanel() {
		this.createRoot(null, "Password", "view change-password", revealPanelUp);
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append('span').text(crv.buttonTexts.cancel);
	
		var addButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Change'))
				{
					username = cr.signedinUser.emails()[0].text();
					if (newPasswordInput.property('value').length == 0)
						syncFailFunction("The new password can not be blank.");
					else if (newPasswordInput.property('value') != confirmPasswordInput.property('value'))
						syncFailFunction("The confirm password does not match the new password.");
					else
					{
						cr.updatePassword(username, 
										  currentPasswordInput.property('value'),
										  newPasswordInput.property('value'))
							.then(function()
								  {
									_this.hideRight(
										function()
										{
											bootstrap_alert.show($('.alert-container'), "Password Changed", "alert-info");
											unblockClick();
										});
								  },
								  syncFailFunction);
					}
				}
				d3.event.preventDefault();
			});
		addButton.append('span').text('Change');
	
		navContainer.appendTitle('Password');
	
		var panel2Div = this.appendFillArea();
			
		var form = panel2Div.append('form')
						.classed('form-simple form-signin', true);
		form.append('label').attr('for', 'id_currentpassword').attr('class', 'sr-only').text('Current Password');
		var currentPasswordInput = form.append('input')
			.attr('type', 'password')
			.attr('id', 'id_currentpassword')
			.attr('name', 'currentpassword')
			.attr('placeholder', 'Current password')
			.attr('required', '1')
			.classed('form-control', true);
		
		form.append('label').attr('for', 'id_newpassword').attr('class', 'sr-only').text('New Password');
		var newPasswordInput = form.append('input')
			.attr('type', 'password')
			.attr('id', 'id_newpassword')
			.attr('name', 'newpassword')
			.attr('placeholder', 'New password')
			.attr('required', '1')
			.classed('form-control', true);
			
		form.append('label').attr('for', 'id_confirmpassword').attr('class', 'sr-only').text('Confirm Password');
		var confirmPasswordInput = form.append('input')
			.attr('type', 'password')
			.attr('id', 'id_confirmpassword')
			.attr('name', 'confirmpassword')
			.attr('placeholder', 'Confirm password')
			.attr('required', '1')
			.classed('form-control', true);
			
		$(this.node()).on("revealing.cr", function()
			{
				currentPasswordInput.node().focus();
			});
			
	}
	
	return UpdatePasswordPanel;
})();

var UpdateUsernamePanel = (function () {
	UpdateUsernamePanel.prototype = Object.create(crv.SitePanel.prototype);
	UpdateUsernamePanel.prototype.constructor = UpdateUsernamePanel;

	function UpdateUsernamePanel(user) {
		this.createRoot(null, "Username", "view", revealPanelUp);
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text(crv.buttonTexts.cancel);
	
		function onChange()
			{
				if (prepareClick('click', 'Change'))
				{
					if (newUsernameInput.property('value').length == 0)
						syncFailFunction("The new username can not be blank.");
					else if (currentPasswordInput.property('value').length == 0)
						syncFailFunction("The password is required.");
					else
					{
						cr.updateUsername(newUsernameInput.property('value'),
										  currentPasswordInput.property('value'))
						.then(function()
							  {
								_this.hideRight(function()
									{
										bootstrap_alert.show($('.alert-container'), "Email Changed", "alert-info");
										unblockClick();
									});
							  },
							  syncFailFunction);
					}
				}
			}
			
		var addButton = navContainer.appendRightButton()
			.on("click", function()
				{
					onChange();
					d3.event.preventDefault();
				});
		addButton.append('span').text('Change');
	
		navContainer.appendTitle('Email');
	
		var panel2Div = this.appendFillArea();
			
		var form = panel2Div.append('form')
						.classed('form-simple form-signin', true);
		form.append('div')
			.classed('help-block', true)
			.text("Current Email: " + cr.signedinUser.emails()[0].text());
		
		form.append('label').attr('for', 'id_newusername').attr('class', 'sr-only').text('New Email');
		var newUsernameInput = form.append('input')
			.attr('type', 'email')
			.attr('id', 'id_newusername')
			.attr('name', 'newUsername')
			.attr('placeholder', 'New Email')
			.attr('required', '1')
			.classed('form-control', true);
			
		form.append('label').attr('for', 'id_currentpassword').attr('class', 'sr-only').text('Password');
		var currentPasswordInput = form.append('input')
			.attr('type', 'password')
			.attr('id', 'id_currentpassword')
			.attr('name', 'currentpassword')
			.attr('placeholder', 'Password')
			.attr('required', '1')
			.classed('form-control', true);

			$(currentPasswordInput.node()).keypress(function(e) {
				if (e.which == 13)
				{
					onChange();
					e.preventDefault();
				}
			});
			
		$(this.node()).on("revealing.cr", function()
			{
				newUsernameInput.node().focus();
			});
	}
	
	return UpdateUsernamePanel;
})();
