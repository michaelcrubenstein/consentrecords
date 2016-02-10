var UpdatePasswordPanel = (function () {
	UpdatePasswordPanel.prototype = new SitePanel();

	UpdatePasswordPanel.prototype.submit = function(username, oldPassword, newPassword, successFunction, failFunction)
	{
		bootstrap_alert.show($('.alert-container'), "Updating Password...<br>(this may take a minute)", "alert-info");

		$.post(cr.urls.updatePassword, 
			{ csrfmiddlewaretoken: $.cookie("csrftoken"), 
				username: username,
				oldPassword: oldPassword,
				newPassword: newPassword,
				timezoneoffset : new Date().getTimezoneOffset()
			})
		  .done(function(json, textStatus, jqXHR)
			{
				if (json['success']) {
					successFunction(json.user);
				}
				else {
					failFunction(json.error);
				}
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
		  });
	}

	function UpdatePasswordPanel(previousPanelNode) {
		SitePanel.call(this, previousPanelNode, null, "Password", "background-gradient-panel", revealPanelLeft);
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
	
		var addButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					username = userInstance.getDatum("_email");
					if (newPasswordInput.property('value') != confirmPasswordInput.property('value'))
						syncFailFunction("The confirm password does not match the new password.");
					else
					{
						cr.updatePassword(username, 
										  currentPasswordInput.property('value'),
										  newPasswordInput.property('value'),
										  function() {
										  	hidePanelRight(_this.node());
										  	bootstrap_alert.show($('.alert-container'), "Password Changed", "alert-info");
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
			
	}
	
	return UpdatePasswordPanel;
})();
