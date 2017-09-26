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
	return $(this.passwordInput).val() !== "" &&
		$(this.emailInput).val() !== "";
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
	}

	function SigninPanel()
	{
		this.createRoot(null, "Sign In", "sign-in", revealPanelUp);
		var _this = this;

		var form = this.panelDiv.append('form')
			.classed('form-simple form-signin', true);
		
		form.append('div')
			.classed('site-title', true)
			.text("Sign In to PathAdvisor");
		
		this.emailInput = form.append('input')
				.attr('type', 'email')
				.attr('maxlength', '254')
				.classed('form-control', true)
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
				.attr('type', 'password')
				.attr('maxlength', '254')
				.classed('form-control', true)
				.attr('placeholder', 'Password')
				.attr('required', '')
				.on('input', function() { _this.checkenabled(); })
				.on('keypress', function() {
						if (d3.event.which == 13)
						{
							if (prepareClick('return key', 'Signin sign in'))
							{
								try
								{
									if (_this.canSubmit())
									{
										_this.submit()
											.then(function(data)
											{
												cr.createSignedinUser(data.id)
													.then(function()
													{
														_this.hideRight(unblockClick);
													},
													cr.syncFail);
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
								}
								catch(err)
								{
									cr.syncFail(err);
								}
							}
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
	
		rememberMeCheckboxLabel.append('text').text(" Remember me");
			
		var buttonContainer = form.append('div')
			.classed('form-group site-trio-container', true);
			
		buttonContainer.append('span')
			.classed('signin-cancel-button site-trio-clipped site-active-text', true)
			.text(crv.buttonTexts.cancel)
			.on('click', function()
				{
					if (prepareClick('click', 'hide panel button'))
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
					}
					d3.event.preventDefault();
				});
							
		buttonContainer.append('div')
			.classed('site-trio-fill', true);
		
		this.signinButton = buttonContainer.append('span')
			.classed('submit-button site-trio-clipped site-active-text default-link', true)
			.text("Sign In")
			.on('click', function()
				{
					if (prepareClick('click', 'Signin Sign in'))
					{
						try
						{
							_this.submit()
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
						new ForgotPasswordPanel(_this.node())
							.showUp()
							.always(unblockClick);
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			});

		$(this.node()).on("revealing.cr", function()
			{
				$(_this.emailInput).val($.cookie("email"));
				$(_this.passwordInput).val("");
		
				if ($(_this.emailInput).val() !== "")
				{
					$(_this.rememberMeCheckbox).prop("checked", true);
					$(_this.passwordInput).focus();
				}
				else
					$(_this.emailInput).focus();
		
				_this.checkenabled();
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
			$(this.emailGroup).removeClass( "has-success");
			$(this.emailOK).removeClass( "glyphicon-ok" );
		}
		else
		{
			$(this.submitButton).removeClass("site-disabled-text")
							   .addClass("site-active-text")
							   .prop( "disabled", false );
			$(this.emailGroup).addClass( "has-success");
			$(this.emailOK).addClass( "glyphicon-ok" );
		}
	}
			
	ForgotPasswordPanel.prototype.submit = function(successFunction, failFunction) {
		var _this = this;
		bootstrap_alert.success('Sending email (this may take a few minutes)...', this.alertSuccess);
		
		$.post(cr.urls.resetPassword, 
			{ "email": $(this.emailInput).val()
			})
		  .done(function(json, textStatus, jqXHR)
			{
				bootstrap_alert.close();
				bootstrap_alert.success('Your email has been sent. <a href="{{nextURL}}">Continue</a>', _this.alertSuccess);
				successFunction();
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
			cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
		  });
	}
				
	function ForgotPasswordPanel(signinPanel)
	{
		this.createRoot(null, "Forgot Password", "sign-in", revealPanelUp);
		var _this = this;
		
		var form = this.panelDiv.append('form')
			.classed('form-simple', true);
		
		form.append('div')
			.classed('site-title', true)
			.text("Forgot your Password?");
		
		form.append('div')
			.classed('help-block', true)
			.text("Enter your email address to receive an email with a link you can click to reset your password.");
			
		var emailGroup = form.append('div')
			.classed('row', true)
			.append('div')
			.classed('col-xs-12', true)
			.append('div')
			.classed('form-group has-feedback', true);
		this.emailGroup = emailGroup.node();
		
		this.emailInput = emailGroup.append('input')
			.classed('form-control feedback-control', true)
			.attr('type', 'email')
			.attr('placeholder', "Email Address")
			.on("input", function() { _this.checkenabled(); })
			.node();
			
		this.emailOK = emailGroup.append('span')
			.classed("glyphicon form-control-feedback", true)
			.node();
		
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
							_this.hideRight(unblockClick);
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
			.text("Send Email")
			.on('click', function()
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
				});
				
		this.alertSuccess = form.append('div')
			.classed('row', true)
			.append('div')
			.classed('col-xs-12 div-success', true)
			.node();
			
		$(this.node()).on("revealing.cr", function()
		{
			$(_this.emailInput).val("")
				.focus();
			_this.checkenabled();
		});
		
/* 
			<form class="form-simple">
				<div class="site-title">Forgot your Password?</div>
				<div class="help-block">Enter your email address to receive an email with a link you can click to reset your password.</div>

				<div class="row">
					<div class="alert-container col-xs-12"></div>
				</div>

			  <div class="row">
					<div class="col-xs-12">
						<div id="id_email_group" class="form-group has-feedback">
							<label for="id_email"  class="control-label sr-only">Email Address</label>
							<input id="id_email" class="form-control feedback-control" type="email" placeholder="Email"/>
							<span id="id_emailOK" class="glyphicon form-control-feedback"></span>
						</div>
					</div> 
			  </div>
				<div class="form-group site-trio-container">
					<span class="done-button site-trio-clipped site-active-text">Cancel</span>
					<div class="site-trio-fill"></div>
					<span class="submit-button site-trio-clipped site-active-text">Send&nbsp;Email</span>
				</div>
				<div class="row">
					<div id="id_alert_success" class="col-xs-12 div-success"></div>
				</div>
			</form>
 */
	}
	return ForgotPasswordPanel;
})();