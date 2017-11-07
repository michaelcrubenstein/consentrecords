var UpdatePasswordPanel = (function () {
	UpdatePasswordPanel.prototype = Object.create(crv.SitePanel.prototype);
	UpdatePasswordPanel.prototype.constructor = UpdatePasswordPanel;

	UpdatePasswordPanel.prototype.submitNewPassword = function(oldPassword, newPassword, confirmPassword)
	{
		if (prepareClick('click', 'Change'))
		{
			var _this = this;
			var username = cr.signedinUser.emails()[0].text();
			if (newPassword.length == 0)
				syncFailFunction("The new password can not be blank.");
			else if (newPassword != confirmPassword)
				syncFailFunction("The confirm password does not match the new password.");
			else
			{
				cr.updatePassword(username, oldPassword, newPassword)
					.then(function()
						  {
							_this.hideRight(
								function()
								{
									bootstrap_alert.show(null, "Password Changed", 'alert-info');
									unblockClick();
								});
						  },
						  syncFailFunction);
			}
		}
		d3.event.preventDefault();
	}
	
	UpdatePasswordPanel.prototype.checkenabled = function() {
		var submitEnabled = true;			
		
		if (this.passwordInput.value &&
			this.passwordInput.value.length >= 6)
		{
			this.passwordOK.textContent = crv.buttonTexts.checkmark;
		}
		else
		{
			submitEnabled = false;
			this.passwordOK.textContent = "";
		}
		
		if (this.confirmInput.value &&
			this.passwordInput.value == this.confirmInput.value)
		{
			this.confirmOK.textContent = crv.buttonTexts.checkmark;
		}
		else
		{
			submitEnabled = false;
			this.confirmOK.textContent = "";
		}
		
		if (submitEnabled)
		{
			$(this.submitButton).removeClass("site-disabled-text")
							   .addClass("site-active-text")
							   .prop( "disabled", false );
		}
		else
		{
			$(this.submitButton).addClass("site-disabled-text")
							   .removeClass("site-active-text")
							   .prop( "disabled", true );
		}
	}
			
	function UpdatePasswordPanel(backButtonText) {
		this.createRoot(null, "Password", 'view change-password sign-in', revealPanelLeft);
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on('click', function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		appendLeftChevronSVG(backButton).classed("site-active-text chevron-left", true);
		backButton.append("span").text(backButtonText);
	
		navContainer.appendTitle("Password");
	
		var submitButton = navContainer.appendRightButton()
			.on('click', function()
			{
				_this.submitNewPassword(currentPasswordInput.value,
					_this.passwordInput.value,
					_this.confirmInput.value);
			});
		submitButton.append('span')
			.classed('default-link', true)
			.text('Change');
		this.submitButton = submitButton.node();
	
		var panel2Div = this.appendFillArea();
			
		var form = panel2Div.append('form')
						.classed('form-simple form-signin', true);
		form.append('label').attr('for', 'id_currentpassword').attr('class', 'sr-only').text('Current Password');
		var currentPasswordInput = form.append('input')
			.attr('type', 'password')
			.attr('id', 'id_currentpassword')
			.attr('name', 'currentpassword')
			.attr('placeholder', 'Current password')
			.classed('feedback-control', true)
			.attr('required', '1')
			.attr('autofocus', '')
			.node();
		
		var passwordGroup = form.append('div')
			.classed('form-group', true);
		var passwordLabel = passwordGroup.append('label')
			.attr('for', 'id_newPassword')
			.classed('control-label sr-only', true)
			.text("New Password");
		this.passwordInput = passwordGroup.append('input')
			.attr('id', 'id_newPassword')
			.classed('feedback-control', true)
			.attr('type', 'password')
			.attr('placeholder', "New password")
			.attr('required', '1')
			.on('input', function() { _this.checkenabled(); })
			.node();
		this.passwordOK = passwordGroup.append('span')
			.classed('success-feedback', true)
			.node();

		var confirmGroup = form.append('div')
			.classed('form-group', true);
		this.confirmGroup = confirmGroup.node();
		var confirmLabel = confirmGroup.append('label')
			.attr('for', 'id_confirmNewPassword')
			.classed('control-label sr-only', true)
			.text("Confirm Password");
		this.confirmInput = confirmGroup.append('input')
			.attr('type', 'password')
			.attr('id', 'id_confirmNewPassword')
			.classed('feedback-control', true)
			.attr('placeholder', "Confirm password")
			.attr('required', '1')
			.on('input', function() { _this.checkenabled(); })
			.on('keypress', function()
				{
					if (d3.event.which == 13)
					{
						_this.submitNewPassword(currentPasswordInput.value,
							_this.passwordInput.value,
							_this.confirmInput.value);
					}
				})
			.node();
		this.confirmOK = confirmGroup.append('span')
			.classed('success-feedback', true)
			.node();
			
		/* Force scrolling to the top for small screens. */
		document.body.scrollTop = 0;

		$(this.node()).on("revealing.cr", function()
			{
				currentPasswordInput.focus();
				_this.checkenabled();
			});
	}
	
	return UpdatePasswordPanel;
})();

var UpdateUsernamePanel = (function () {
	UpdateUsernamePanel.prototype = Object.create(crv.SitePanel.prototype);
	UpdateUsernamePanel.prototype.constructor = UpdateUsernamePanel;

	function UpdateUsernamePanel(user, backButtonText) {
		this.createRoot(null, "Username", 'sign-in', revealPanelLeft);
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
		appendLeftChevronSVG(backButton).classed("site-active-text chevron-left", true);
		backButton.append("span").text(backButtonText);
	
		function onChange()
			{
				if (prepareClick('click', 'Change'))
				{
					if (newUsernameInput.property('value').length == 0)
						syncFailFunction("The new username can not be blank.");
					else if (currentPasswordInput.value.length == 0)
						syncFailFunction("The password is required.");
					else
					{
						cr.updateUsername(newUsernameInput.property('value'),
										  currentPasswordInput.value)
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
			
		navContainer.appendTitle('Email');
	
		var submitButton = navContainer.appendRightButton()
			.on('click', function()
				{
					onChange();
					d3.event.preventDefault();
				});
		submitButton.append('span').text('Change');
		this.submitButton = submitButton.node();
	
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
			.attr('autofocus', '');
			
		form.append('label').attr('for', 'id_currentpassword').attr('class', 'sr-only').text('Password');
		var currentPasswordInput = form.append('input')
			.attr('type', 'password')
			.attr('id', 'id_currentpassword')
			.attr('name', 'currentpassword')
			.attr('placeholder', 'Password')
			.attr('required', '1')
			.node();

			$(currentPasswordInput).keypress(function(e) {
				if (e.which == 13)
				{
					onChange();
					e.preventDefault();
				}
			});
			
		/* Force scrolling to the top for small screens. */
		document.body.scrollTop = 0;

		$(this.node()).on("revealing.cr", function()
			{
				newUsernameInput.node().focus();
			});
	}
	
	return UpdateUsernamePanel;
})();
