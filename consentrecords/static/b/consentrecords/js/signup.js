var Signup = (function () {
	Signup.prototype = Object.create(crv.SitePanel.prototype);
	Signup.prototype.constructor = Signup;

	Signup.prototype.dots = null;

	Signup.prototype.checkUnusedEmail = function(email, successFunction, failFunction) {
		bootstrap_alert.show($('.alert-container'), "Checking Email Address...\n(this may take a minute)", "alert-info");

		$.post(cr.urls.checkUnusedEmail, 
			{ email: email,
			})
		  .done(function()
			{
				bootstrap_alert.close();
				if (successFunction)
					successFunction();
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			});
	}
			
	Signup.prototype.submit = function(username, password, initialData)
	{
		bootstrap_alert.show($('.alert-container'), "Signing up...\n(this may take a minute)", "alert-info");

		return $.post(cr.urls.submitNewUser, 
			{ username: username,
				password: password,
				properties: JSON.stringify(initialData)
			})
		  .then(function(json, textStatus, jqXHR)
			{
				var r2 = $.Deferred();
				r2.resolve(json.user);
				return r2;
			}, cr.thenFail);
	}

	function Signup(initialData)
	{
		initialData = initialData !== undefined ? initialData : {};
	
		var _thisSignup = this
		this.createRoot(null, "Sign Up for Consent Records", "sign-up", revealPanelUp);

		var navContainer = this.appendNavContainer();

		var panel2Div = this.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		this.dots = new DotsNavigator(panel2Div, 2);
		this.dots.datum = this;	
		this.dots.finalText = "Create";	

		this.dots.appendBackButton(navContainer, function() {
			_thisSignup.hideDown(unblockClick);
		});
		
		navContainer.appendTitle('New Account');

		this.dots.appendForwardButton(navContainer, function()
			{
				var initialData = {};
				_thisSignup.submit(_thisSignup.getEmail(), _thisSignup.getPassword(), 
					initialData)
					.then(function(data)
						{
							return cr.createSignedinUser(data.id);
						}, 
						cr.chainFail)
					.then(function(user)
						{
							$("panel.sign-in").hide("slide", {direction: "right"}, 0);
							_thisSignup.hideDown(unblockClick);
						},
						cr.syncFail);				
			});

		function getAlignmentFunction(done)
		{
			var timeout = null;
			return function()
				{
					clearTimeout(timeout);
					var _this = this;
					timeout = setTimeout(function()
						{
							var itemHeight = Math.round($(_this).children('li:first-child').outerHeight());
							var scrollTop =  Math.round($(_this).scrollTop());
							if (scrollTop % itemHeight < itemHeight / 2)
								$(_this).animate({"scrollTop": scrollTop - (scrollTop % itemHeight)}, 200, 'swing', done);
							else
								$(_this).animate({"scrollTop": scrollTop + itemHeight - (scrollTop % itemHeight)}, 200, 'swing', done);
						}, 110);
				}
		}
		
		function getPickedItem(listNode)
		{
			var itemHeight = Math.round($(listNode).children('li:first-child').outerHeight());
			var pickedItem = Math.round($(listNode).scrollTop() / itemHeight);
			return $(listNode).children('li:nth-child({0})'.format(pickedItem + 1)).text();
		}
		
		/* Return the 0-based index of the selected item. */
		function getPickedIndex(listNode)
		{
			var itemHeight = Math.round($(listNode).children('li:first-child').outerHeight());
			return Math.round($(listNode).scrollTop() / itemHeight);
		}
		
		function setupPanel2(signup)
		{
			var p = d3.select(this);
			
			p.append('h1').classed('', true)
				.text('Email Address');

			var tr = p.append('table').classed('labeled', true)
				.append('tr');
			tr.append('td').text('Email');
			var emailInput = tr.append('td')
				.classed('full-width', true)
				.append('input')
				.attr('type', 'email')
				.attr('placeholder', 'person@example.com')
				.on('input', function(d)
					{
						signup.dots.checkForwardEnabled();
					});
					
			if (initialData.email)
				emailInput.attr('value', initialData.email);
					
			$(emailInput.node()).keypress(function(e) {
				if (e.which == 13)
				{
					signup.dots.goForward();
					e.preventDefault();
				}
			});
				
			p.append('p')
				.text('Your email address identifies your account. Choose an email address that you can ' +
						'keep for a long time, even if you change schools or jobs.');
						
			p.append('p')
				.text('Your email address will also be used if you forget your password.');
				
			signup.getEmail = function()
			{
				return emailInput.property("value");
			}

			this.onGoingForward = function(gotoNext)
			{
				function validateEmail(email) 
				{
					var re = /\S+@\S+\.\S\S+/;
					return re.test(email);
				}
		
				if (emailInput.property("value") == 0)
				{
					syncFailFunction("The email address is required.");
					emailInput.node().focus();
				}
				else if (!validateEmail(emailInput.property("value")))
				{
					syncFailFunction("The email address is not in a recognized format.");
					emailInput.node().focus();
				}
				else
				{
					_thisSignup.checkUnusedEmail(signup.getEmail(), gotoNext, function(error)
					{
						syncFailFunction(error);
						emailInput.node().focus();
					});
				}
			}
				
			this.onReveal = null;
		}
	
		function setupPanel3(signup)
		{
			var p = d3.select(this);
			
			p.append('h1').classed('', true)
				.text('Password');
			
			var t = p.append('table').classed('labeled', true);
				
			var row = t.append('tr');
			row.append('td').text('Password');
			var passwordInput = row.append('td')
				.classed('full-width', true)
				.append('input')
				.attr('type', 'password')
				.attr('placeholder', 'required')
				.on('input', function(d)
					{
						signup.dots.checkForwardEnabled();
					});
			var okPasswordSpan = row.append('td')
				.append('span')
				.classed('glyphicon', true);
			
			var verifyAlertRow = t.append('tr')
				.style("display", "none");
			verifyAlertRow.append('td');
			var alertContainerDiv = verifyAlertRow.append('td').classed('full-width', true);
			verifyAlertRow.append('td');
			
			function showVerifyAlert(message)
			{
				verifyAlertRow.style("display", null);
				var alertDiv = alertContainerDiv
					.append('div').classed('alert alert-danger alert-dismissable', true);
				var closeBox = alertDiv.append('button').attr('type', 'button')
						.classed('close', true)
						.attr('data-dismiss', 'alert')
						.attr('aria-hidden', 'true');
				$(closeBox.node()).html('&times;');
				$(closeBox.node()).one('click', function() { verifyAlertRow.style("display", "none"); });
				alertDiv.append('span')
					.text('The password and verification do not match.');
					
				unblockClick();
			}
		
			var row = t.append('tr');
			row.append('td').text('Verify');
			var verifyInput = row.append('td')
				.classed('full-width', true)
				.append('input')
				.attr('type', 'password')
				.attr('placeholder', 're-type your password')
				.on('input', function(d)
					{
						signup.dots.checkForwardEnabled();
					});
			var okVerifySpan = row.append('td')
				.append('span')
				.classed('glyphicon', true);
			
			p.append('p')
				.text('Your password must be at least 6 characters.');
				
			signup.getPassword = function()
			{
				return passwordInput.property("value");
			}

			this.onGoingForward = function(gotoNext)
			{
				var password = signup.getPassword();
				if (password.length < 6)
				{
					syncFailFunction('The password is less than six characters.');
					passwordInput.node().focus();
				}
				else if (verifyInput.property("value") != password)
				{
					showVerifyAlert('The password and the password verification do not match.');
					verifyInput.node().focus();
				}
				else
					gotoNext();
			}
			
			function handleReturn(e) {
				if (e.which == 13)
				{
					signup.dots.goForward();
					e.preventDefault();
				}
			}
			
			$(passwordInput.node()).keypress(handleReturn);
			$(verifyInput.node()).keypress(handleReturn);
				
			this.onReveal = null;
		}
	
		this.dots.nthPanel(0).onReveal = setupPanel2;
		this.dots.nthPanel(1).onReveal = setupPanel3;
		
		setTimeout(function()
			{
				_thisSignup.dots.showDots();
			});
	}
	
	return Signup;
})();

var SigninPanel = (function()
{
	SigninPanel.prototype = Object.create(crv.SitePanel.prototype);
	SigninPanel.prototype.constructor = SigninPanel;

	SigninPanel.prototype.canSubmit = function() {
		return $(this.passwordInput).val() &&
			$(this.emailInput).val();
	},

	SigninPanel.prototype.checkenabled = function() {			
		if (!this.canSubmit())
		{
			this.signinButton.classed("site-disabled-text", true)
				.classed("site-active-text", false);
		}
		else
		{
			this.signinButton.classed("site-disabled-text", false)
				.classed("site-active-text", true);
		}
	},
	
	SigninPanel.prototype.submit = function() {
		if (!$(this.emailInput).val())
		{
			var r2 = $.Deferred();
			r2.reject();
			this.emailInput.focus();
			this.emailMessageReveal.show({duration: 400});
			return r2;
		}
		else
		{
			this.emailMessageReveal.hide({duration: 400});
		}
		
		if (!$(this.passwordInput).val())
		{
			var r2 = $.Deferred();
			r2.reject();
			this.passwordInput.focus();
			this.passwordMessageReveal.show({duration: 400});
			return r2;
		}
		else
			this.passwordMessageReveal.hide({duration: 400});
		
		bootstrap_alert.show($('.alert-container'), "Signing In...", "alert-info");
		
		var _this = this;
		return $.post(cr.urls.submitSignin, { username : $(this.emailInput).val(),
									  password : $(this.passwordInput).val() })
			.then(function(json)
				{
					if ($(_this.rememberMeCheckbox).prop("checked"))
						$.cookie("email", $(_this.emailInput).val(), { expires : 10 });
					else
						$.removeCookie("email");
				
					$(_this.emailInput).val("")
					$(_this.passwordInput).val("")
				
					$.cookie("authenticator", "email", { path: "/"});
					var r2 = $.Deferred();
					r2.resolve(json.user);
					return r2;
				},
				cr.thenFail);
	}

	SigninPanel.prototype.initializeFocus = function()
	{
		if ($(this.emailInput).val() !== "")
		{
			$(this.rememberMeCheckbox).prop("checked", true);
			$(this.passwordInput).focus();
		}
		else
			$(this.emailInput).focus();
			
		/* Force scrolling to the top for small screens. */
		document.body.scrollTop = 0;
		
		this.checkenabled();
	}
	
	SigninPanel.prototype.submitSignin = function()
	{
		if (prepareClick('click', 'Signin Sign in'))
		{
			try
			{
				var _this = this;
				this.submit()
					.then(function(data)
						{
							cr.createSignedinUser(data.id)
								.then(function()
								{
									_this.hideRight(unblockClick);
								},
								cr.syncFail)
						}, 
						function(err)
						{
							/* Error may be handled in submit, in which
								case err will be undefined. */
							if (err) 
								cr.syncFail(err);
							else
								unblockClick();
						});
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
	}

	function SigninPanel()
	{
		this.createRoot(null, "Sign In", "sign-in", revealPanelUp);
		var _this = this;
		
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on('click', function() 
				{
					try
					{
						showClickFeedback(this);
						_this.hideRight(function()
							{
								$(cr.signedinUser).trigger("signinCanceled.cr");
								unblockClick();
							});
					}
					catch(err)
					{
						cr.syncFail(err);
					}
					d3.event.preventDefault();
					d3.event.stopPropagation();
				});
		backButton.append('span').text(crv.buttonTexts.cancel);

		navContainer.appendTitle("Sign In to PathAdvisor");

		var form = this.panelDiv.append('form')
			.classed('form-simple form-signin', true);
		
		this.emailInput = form.append('input')
				.classed('base-input', true)
				.attr('type', 'email')
				.attr('maxlength', '254')
				.attr('placeholder', 'Email address')
				.attr('required', '')
				.attr('autofocus', '')
				.on('input', function() { _this.checkenabled(); })
				.node();
		this.emailMessage = form.append('div')
			.classed('message', true);
		this.emailMessage.append('div')
			.text('The email address is required.');
		this.emailMessageReveal = new VerticalReveal(this.emailMessage.node());
		this.emailMessageReveal.hide();
		
		this.passwordInput = form.append('input')
				.classed('base-input', true)
				.attr('type', 'password')
				.attr('maxlength', '254')
				.attr('placeholder', 'Password')
				.attr('required', '')
				.on('input', function() { _this.checkenabled(); })
				.on('keypress', function() {
						if (d3.event.which == 13)
						{
							_this.submitSignin();
							d3.event.preventDefault();
						}
					})
				.node();
		this.passwordMessage = form.append('div')
			.classed('message', true);
		this.passwordMessage.append('div')
			.text('The password is required.');
		this.passwordMessageReveal = new VerticalReveal(this.passwordMessage.node());
		this.passwordMessageReveal.hide();
				
		var rememberMeCheckboxLabel = form.append('div')
			.classed('checkbox', true)
			.append('label');
			
		this.rememberMeCheckbox = rememberMeCheckboxLabel.append('input')
			.attr('type', 'checkbox')
			.node();
	
		rememberMeCheckboxLabel.append('text').text("Remember me");
			
		var buttonContainer = form.append('div')
			.classed('form-group site-trio-container', true);
			
		buttonContainer.append('div')
			.classed('site-trio-fill', true);
		
		this.signinButton = buttonContainer.append('span')
			.classed('submit-button site-trio-clipped site-active-text default-link', true)
			.text("Sign In")
			.on('click', function()
				{
					_this.submitSignin();

					//stop form submission
					d3.event.preventDefault();
				});

		this.panelDiv.append('hr');
		
		var newAccountDiv = this.panelDiv.append('div')
			.classed('div-create-new-account other-action', true);
		newAccountDiv.append('span')
			.text("Don't have an account?");
		newAccountDiv.append('a')
			.classed('site-active-text', true)
			.text('Create one now.')
			.on('click', function() {
				if (prepareClick('click', 'Signin sign up'))
				{
					try
					{
						new Signup()
							.showUp()
							.always(unblockClick);
					}
					catch (err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			});
		
		var forgotPasswordDiv = this.panelDiv.append('div')
			.classed('div-forgot-password other-action', true);
		forgotPasswordDiv.append('span')
			.text("Forgot your password?");
		forgotPasswordDiv.append('a')
			.classed('site-active-text', true)
			.text('Reset it now.')
			.on('click', function() {
				if (prepareClick('click', 'Signin forgot password'))
				{
					try
					{
						var panel = new ForgotPasswordPanel(_this.node());
						
						$(panel.node()).on('hiding.cr', function()
							{
								$(_this.emailInput).css('display', '');
								$(_this.passwordInput).css('display', '');
							});
						panel.showUp()
							.then(function()
							{
								$(_this.emailInput).css('display', 'none');
								$(_this.passwordInput).css('display', 'none');
							},
							cr.asyncFail)
							.always(unblockClick);
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			});

		$(this.node()).on('revealing.cr', function()
			{
				$(_this.emailInput).val($.cookie('email'));
				$(_this.passwordInput).val("");
			});
	}

	return SigninPanel;
})();

var ForgotPasswordPanel = (function()
{
	ForgotPasswordPanel.prototype = Object.create(crv.SitePanel.prototype);
	ForgotPasswordPanel.prototype.constructor = ForgotPasswordPanel;

	ForgotPasswordPanel.prototype.submitButton = null;
	ForgotPasswordPanel.prototype.emailGroup = null;
	ForgotPasswordPanel.prototype.emailInput = null;
	ForgotPasswordPanel.prototype.emailOK = null;
	
	ForgotPasswordPanel.prototype.canSubmit = function() {
		var testusername = $(this.emailInput).val();
		return validateEmail(testusername);
	}

	ForgotPasswordPanel.prototype.checkenabled = function() {			
		if (!this.canSubmit())
		{
			$(this.submitButton).addClass("site-disabled-text")
							   .removeClass("site-active-text")
							   .prop( "disabled", true );
			this.emailOK.textContent = "";
		}
		else
		{
			$(this.submitButton).removeClass("site-disabled-text")
							   .addClass("site-active-text")
							   .prop( "disabled", false );
			this.emailOK.textContent = crv.buttonTexts.checkmark;
		}
	}
			
	ForgotPasswordPanel.prototype.submit = function(successFunction, failFunction) {
		var _this = this;
		bootstrap_alert.success('Sending email (this may take a few minutes)...');
		
		$.post(cr.urls.resetPassword, 
			{ "email": $(this.emailInput).val()
			})
		  .done(function(json, textStatus, jqXHR)
			{
				bootstrap_alert.close();
				bootstrap_alert.success('Your email has been sent. <a href="{{nextURL}}">Continue</a>');
				successFunction();
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
			cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
		  });
	}
	
	/* After showUp is completed, set the focus. */
	ForgotPasswordPanel.prototype.showUp = function()
	{
		var _this = this;
		
		return crv.SitePanel.prototype.showUp.call(this)
			.then(function()
				{
					_this.emailInput.value = '';
					_this.emailInput.focus();
					
					_this.checkenabled();
				},
				cr.chainFail);
	}
				
	function ForgotPasswordPanel(signinPanel)
	{
		this.createRoot(null, "Forgot Password", 'sign-in', revealPanelUp);
		var _this = this;
		
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on('click', function() 
				{
					if (prepareClick('click', 'hide panel button'))
					{
						try
						{
							showClickFeedback(this);
							_this.hideDown(unblockClick);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.preventDefault();
					d3.event.stopPropagation();
				});
		backButton.append('span').text(crv.buttonTexts.cancel);

		var submitFunction = function()
			{
				if (_this.canSubmit())
				{
					if (prepareClick('click', 'forgot password submit'))
					{
						try
						{
							var successFunction = function()
							{
								$(signinPanel).hide("slide", {direction: "right"}, 0);
								_this.hideRight(unblockClick);
							}
							_this.submit(successFunction, cr.syncFail);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				}
				else
				{
					bootstrap_alert.warning('The email address is invalid.');
				}
			   //stop form submission
			   d3.event.preventDefault();
			}
				
		navContainer.appendTitle("Forgot Password");

		var form = this.panelDiv.append('form')
			.classed('form-simple', true);
		
		form.append('div')
			.classed('help-block', true)
			.text("Enter your email address to receive an email with a link you can click to reset your password.");
			
		var emailGroup = form.append('div')
			.append('div')
			.append('div')
			.classed('form-group', true);
		this.emailGroup = emailGroup.node();
		
		this.emailInput = emailGroup.append('input')
			.classed('base-input', true)
			.classed('feedback-control', true)
			.attr('type', 'email')
			.attr('placeholder', "Email Address")
			.attr('required', '')
			.attr('autofocus', '')
			.on('input', function() { _this.checkenabled(); })
			.on('keypress', function()
				{
					if (d3.event.which == 13)
					{
						submitFunction();
					}
				})
			.node();
			
		/* Force scrolling to the top for small screens. */
		document.body.scrollTop = 0;

		this.emailOK = emailGroup.append('span')
			.classed('success-feedback', true)
			.node();
		
		var buttonContainer = form.append('div')
			.classed('form-group site-trio-container', true);
			
		buttonContainer.append('div')
			.classed('site-trio-fill', true);
		
		this.submitButton = buttonContainer.append('span')
			.classed('submit-button site-trio-clipped site-active-text default-link', true)
			.text("Send Email")
			.on('click', submitFunction)
				.node();

	}
	return ForgotPasswordPanel;
})();

var ResetPasswordPanel = (function()
{
	ResetPasswordPanel.prototype = Object.create(crv.SitePanel.prototype);
	ResetPasswordPanel.prototype.constructor = ResetPasswordPanel;

	ResetPasswordPanel.prototype.submitButton = null;
	ResetPasswordPanel.prototype.emailGroup = null;
	ResetPasswordPanel.prototype.emailInput = null;
	ResetPasswordPanel.prototype.emailOK = null;
	
	ResetPasswordPanel.prototype.canSubmit = function() {
		var testusername = $(this.emailInput).val();
		return validateEmail(testusername) &&
			$(this.confirmInput).val() &&
			$(this.passwordInput).val() == $(this.confirmInput).val();
	}

	ResetPasswordPanel.prototype.checkenabled = function() {
		var submitEnabled = true;			
		if (!validateEmail($(this.emailInput).val()))
		{
			submitEnabled = false;
			this.emailOK.textContent = "";
		}
		else
		{
			this.emailOK.textContent = crv.buttonTexts.checkmark;
		}
		
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
			
	ResetPasswordPanel.prototype.submit = function(resetKey) {
		var _this = this;
		
		if (!$(this.emailInput).val())
		{
			var r2 = $.Deferred();
			r2.reject();
			this.emailInput.focus();
			this.emailMessageReveal.show({duration: 400});
			return r2;
		}
		else
		{
			this.emailMessageReveal.hide({duration: 400});
		}
		
		if (!$(this.passwordInput).val())
		{
			var r2 = $.Deferred();
			r2.reject();
			this.passwordInput.focus();
			this.passwordMessageReveal.show({duration: 400});
			return r2;
		}
		else
			this.passwordMessageReveal.hide({duration: 400});
			
		if (!$(this.confirmInput).val())
		{
			var r2 = $.Deferred();
			r2.reject();
			this.confirmInput.focus();
			this.confirmMessageReveal.show({duration: 400});
			return r2;
		}
		else
			this.confirmMessageReveal.hide({duration: 400});

		bootstrap_alert.success('Resetting password (this may take a few minutes)...');
		return $.post(cr.urls.setResetPassword, 
					{resetkey: resetKey,
					 email: this.emailInput.value,
					 password: this.passwordInput.value
					})
			.then(function(json, textStatus, jqXHR)
				{
					cr.logRecord('setResetPassword succeeds', _this.emailInput.value);
					bootstrap_alert.success('Your password has been reset.');
					return cr.createSignedinUser(json.user.id);
				},
				cr.thenFail);
	}
	
	ResetPasswordPanel.prototype.submitReset = function(resetKey)
	{
		var _this = this;
		if (prepareClick('click', 'reset password'))
		{
			try
			{
				this.submit(resetKey)
					.then(function() { _this.hide(); }, 
					function(err)
					{
						if (err)
							cr.syncFail(err);
						else
							unblockClick();
					});
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
	}
				
	function ResetPasswordPanel(resetKey)
	{
		this.createRoot(null, "Reset Password", "sign-in", revealPanelUp);
		var _this = this;
		
		var form = this.panelDiv.append('form')
			.classed('form-simple', true);
		
		form.append('div')
			.classed('site-title', true)
			.text("Reset Password");
		
		form.append('div')
			.classed('help-block', true)
			.text("Enter your email address and a new password to reset your password.");
			
		var emailGroup = form.append('div')
			.append('div')
			.append('div')
			.classed('form-group', true);
		this.emailGroup = emailGroup.node();
		
		this.emailInput = emailGroup.append('input')
			.classed('base-input', true)
			.classed('feedback-control', true)
			.attr('type', 'email')
			.attr('placeholder', "Email Address")
			.on('input', function() { _this.checkenabled(); })
			.node();
			
		this.emailOK = emailGroup.append('span')
			.classed('success-feedback', true)
			.node();
		this.emailMessage = form.append('div')
			.classed('message', true);
		this.emailMessage.append('div')
			.text('The email address is required.');
		this.emailMessageReveal = new VerticalReveal(this.emailMessage.node());
		this.emailMessageReveal.hide();
		
		var passwordGroup = form.append('div')
			.classed('form-group', true);
		var passwordLabel = passwordGroup.append('label')
			.attr('for', 'id_newPassword')
			.classed('control-label sr-only', true)
			.text("New Password");
		this.passwordInput = passwordGroup.append('input')
			.attr('id', 'id_newPassword')
			.classed('base-input', true)
			.classed('feedback-control', true)
			.attr('type', 'password')
			.attr('placeholder', "New password")
			.on('input', function() { _this.checkenabled(); })
			.node();
		this.passwordOK = passwordGroup.append('span')
			.classed('success-feedback', true)
			.node();
		
		this.passwordMessage = form.append('div')
			.classed('message', true);
		this.passwordMessage.append('div')
			.text('The password is required.');
		this.passwordMessageReveal = new VerticalReveal(this.passwordMessage.node());
		this.passwordMessageReveal.hide();

		var confirmGroup = form.append('div')
			.classed('form-group', true);
		this.confirmGroup = confirmGroup.node();
		var confirmLabel = confirmGroup.append('label')
			.attr('for', 'id_confirmNewPassword')
			.classed('control-label sr-only', true)
			.text("Confirm New Password");
		this.confirmInput = confirmGroup.append('input')
			.attr('id', 'id_confirmNewPassword')
			.classed('base-input', true)
			.classed('feedback-control', true)
			.attr('type', 'password')
			.attr('placeholder', "Confirm new password")
			.on('input', function() { _this.checkenabled(); })
			.on('keypress', function()
				{
					if (d3.event.which == 13)
					{
						_this.submitReset(resetKey);
						d3.event.preventDefault();
					}
				})
			.node();
		this.confirmOK = confirmGroup.append('span')
			.classed('success-feedback', true)
			.node();
		this.confirmMessage = form.append('div')
			.classed('message', true);
		this.confirmMessage.append('div')
			.text("The confirmation does not match the password.");
		this.confirmMessageReveal = new VerticalReveal(this.confirmMessage.node());
		this.confirmMessageReveal.hide();

		var buttonContainer = form.append('div')
			.classed('form-group site-trio-container', true);
			
		buttonContainer.append('span')
			.classed('done-button site-trio-clipped site-active-text', true)
			.text(crv.buttonTexts.cancel)
			.on('click', function()
				{
					if (prepareClick('click', 'hide panel button'))
					{
						try
						{
							showClickFeedback(this);
							_this.hide();
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				});
			
		buttonContainer.append('div')
			.classed('site-trio-fill', true);
		
		buttonContainer.append('span')
			.classed('submit-button site-trio-clipped site-active-text', true)
			.text("Reset Password")
			.on('click', function()
				{
					_this.submitReset(resetKey);					
					//stop form submission
					d3.event.preventDefault();
				});
				
		$(this.node()).on("revealing.cr", function()
		{
			$(_this.emailInput).val("")
				.focus();
			_this.checkenabled();
		});
		
	}
	return ResetPasswordPanel;
})();

