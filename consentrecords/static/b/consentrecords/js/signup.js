var Signup = (function () {
	Signup.prototype = new SitePanel();
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
			
	Signup.prototype.submit = function(username, password, initialData, successFunction, failFunction)
	{
		bootstrap_alert.show($('.alert-container'), "Signing up...\n(this may take a minute)", "alert-info");

		$.post(cr.urls.submitNewUser, 
			{ username: username,
				password: password,
				properties: JSON.stringify(initialData)
			})
		  .done(function(json, textStatus, jqXHR)
			{
				successFunction(json.user);
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
		  });
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
		
		this.dots = new DotsNavigator(panel2Div, 3);
		this.dots.datum = this;	
		this.dots.finalText = "Create";	

		this.dots.appendForwardButton(navContainer, function()
			{
				var birthDay = _thisSignup.getBirthday();
				var birthMonth = birthDay.substr(0, 7);
				var initialData = {"Birthday": [{text: birthDay}],
								   "_public access":
								   		[{path: "_term[_name=_privilege]enumerator[_name=_find]"}],
				                   "Path": 
				                   		[{cells: {"Birthday": [{text: birthMonth}] }}
				                   		]};
				_thisSignup.submit(_thisSignup.getEmail(), _thisSignup.getPassword(), 
					initialData, 
					function(data)
					{
						cr.signedinUser.updateFromChangeData(data);
						cr.signedinUser.promiseCells(["_system access"])
							.then(function()
							{
								$("#id_sign_in_panel").hide("slide", {direction: "right"}, 0);
								_thisSignup.hideDown(
									function()
									{
										$(cr.signedinUser).trigger("signin.cr");
										unblockClick();
									});
							},
						cr.syncFail);
					},
					cr.syncFail)
				
			});
		this.dots.appendBackButton(navContainer, function() {
			_thisSignup.hideDown(unblockClick);
		});
		
		navContainer.appendTitle('New Account');

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
		
		function setupPanel0(signup)
		{
			var p = d3.select(this);
			
			p.classed('birthday', true);

			p.append('h1')
				.text('Birthday');
				
			var row = p.append('table').classed('labeled', true)
				.append('tr');
			row.append('td').text('Birth Month');
			var yearCell = row.append('td').classed('full-width', true);
			var monthInput = yearCell.append('div')
				.classed('site-active-text', true)
				.text('month year')
				.on('change', function(d)
					{
						console.log('monthInput change {0}'.format(monthInput.node().selectedIndex));
						d3.select(this).selectAll(":first-child").attr('disabled', true);
						signup.dots.checkForwardEnabled();
					});
			
			var pickerRow = p.select('table').append('tr');
			var pickerCell = pickerRow.append('td')
				.attr('colspan', '2');		
			var datePickerContainer = pickerCell.append('div')
				.classed('wheel', true);
			var monthPickerList = datePickerContainer.append('ol');
			var yearPickerList = datePickerContainer.append('ol');
			
			function setPickedText()
			{
				var m = getPickedItem(monthPickerList.node());
				var y = getPickedItem(yearPickerList.node());
				monthInput.text("{0} {1}".format(m, y));
			}
					
			$(monthPickerList.node()).scroll(getAlignmentFunction(setPickedText));
			$(yearPickerList.node()).scroll(getAlignmentFunction(setPickedText));
			
			var topShade = datePickerContainer.append('div')
				.classed('topShade', true);
			var bottomShade = datePickerContainer.append('div')
				.classed('bottomShade', true);
					
			p.append('p')
				.text('Your birthday will be shared only with people you want. We collect your birth month and year to help match you to the right opportunities.');
				
			var minYear, maxYear;
			maxYear = (new Date()).getUTCFullYear();
	
			minYear = maxYear-100;
		
			var years = [];
			for (var i = maxYear; i >= minYear; --i)
				years.push(i);
			
			yearPickerList.selectAll('li')
				.data(years)
				.enter()
				.append('li')
				.text(function(d) { return d; });
					
			var months = Date.CultureInfo.monthNames;
			
			monthPickerList.selectAll('li')
				.data(months)
				.enter()
				.append('li')
				.text(function(d) { return d; });
				
			var birthdayString = years[0] + "-" + "01";
				
			signup.getBirthday = function()
			{
				var m = getPickedIndex(monthPickerList.node());
				var y = getPickedItem(yearPickerList.node());
				m += 1;
				if (m < 10)
					m = "0{0}".format(m);
				return "{0}-{1}".format(y, m);
			}
			
			setPickedText();
			p.node().onGoingForward = function(gotoNext)
			{
				gotoNext();
			}
			
			p.append('div')
				.append('a').attr('id', "id_termsOfUseLink")
				.classed("btn btn-link btn-xs", true)
				.text("Terms Of Use")
				.on('click', function() {
		var message = "<p>Information in this system will only be used according to your consent except " +
			" as required by law. By signing up for this system, you consent to allow this system to store" +
			" the information you have entered.</p>";
		$(termsAlert.node()).html('<div class="alert alert-info alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'+message+'</div>');

				});
			
			var termsAlert = p.append('div')
				.append('div').attr('id', "id_termsAlert");
				
			this.onReveal = null;
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
	
		function setupPanel4(signup)
		{
			var p = d3.select(this);
			
			p.append('h1').classed('', true)
				.text('Sharing');
			
			p.append('p')
				.text('Do you want your profile to be visible to others?');
			
			var t = p.append('table').classed('option', true);	
			var row = t.append('tr');
			var cell = row.append('td');
			cell.append('input')
				.attr('type', 'radio')
				.attr('name', 'publicAccess')
				.property('value', 'none')
				.on('change', function()
					{
						var _this = this;
						t.selectAll('input').attr('checked', function() { return (_this === this ? 1 : null); });
					});
			cell.append('span').text('Hidden');
			row.append('td').append('p').text('No one will be able to locate or identify you.');

			row = t.append('tr');
			cell = row.append('td');
			var findInput = cell.append('input')
				.attr('type', 'radio')
				.attr('checked', 1)
				.attr('name', 'publicAccess')
				.property('value', '_find')
				.on('change', function()
					{
						var _this = this;
						t.selectAll('input').attr('checked', function() { return (_this === this ? 1 : null); });
					});
			cell.append('span').text('By Request');
			row.append('td').append('p').text('Others can request access to your profile if they know your email address.');

			row = t.append('tr');
			cell = row.append('td');
			var readInput = cell.append('input')
				.attr('type', 'radio')
				.attr('name', 'publicAccess')
				.property('value', '_read')
				.on('change', function()
					{
						var _this = this;
						t.selectAll('input').attr('checked', function() { return (_this === this ? 1 : null); });
					});
			cell.append('span').text('Public');
			row.append('td').append('p').text('Others can look at your profile (except for information you hide from view).');

			signup.getPublicAccess = function()
			{
				var s = t.selectAll('input[name=publicAccess]:checked').property('value');
				if (s === 'none')
					return null;
				else
					return s;
			}
			
			this.onCheckFowardEnabled = function()
			{
				return false;	/* Block moving forward until the following script completes. */
			}
			
			crp.promise({path: '_term[_name=_privilege]'})
				.done(function(newInstances)
					{
						var enumeratorCell = newInstances[0].getCell('enumerator');
						for (var i = 0; i < enumeratorCell.data.length; ++i)
						{
							var d = enumeratorCell.data[i];
							if (d.getDescription() === '_read')
								readInput.property('value', d.getInstanceID());
							else if (d.getDescription() === '_find')
								findInput.property('value', d.getInstanceID());
						}
						p.node().onCheckForwardEnabled = undefined;
						signup.dots.checkForwardEnabled();
					})
				.fail(cr.asyncFail);
			
			this.onReveal = null;
		}
	
		this.dots.nthPanel(0).onReveal = setupPanel2;
		this.dots.nthPanel(1).onReveal = setupPanel3;
		this.dots.nthPanel(2).onReveal = setupPanel0;
		
		setTimeout(function()
			{
				_thisSignup.dots.showDots();
			});
	}
	
	return Signup;
})();

var SigninPanel = (function()
{
	SigninPanel.prototype = new SitePanel();
	
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

	SigninPanel.prototype.submit = function(successFunction, failFunction) {
		if (!this.canSubmit())
			return;
		
		bootstrap_alert.show($('.alert-container'), "Signing In...", "alert-info");
		
		var _this = this;
		$.post(cr.urls.submitSignin, { username : $(this.emailInput).val(),
									  password : $(this.passwordInput).val() })
			.done(function(json)
				{
					if ($(_this.rememberMeCheckbox).prop("checked"))
						$.cookie("email", $(_this.emailInput).val(), { expires : 10 });
					else
						$.removeCookie("email");
				
					$(_this.emailInput).val("")
					$(_this.passwordInput).val("")
				
					$.cookie("authenticator", "email", { path: "/"});
					if (successFunction)
						successFunction(json.user);
				})
			.fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
				});
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
		
		form.append('div')
			.classed('alert-container', true);
			
		this.emailInput = form.append('input')
				.attr('type', 'email')
				.attr('maxlength', '254')
				.classed('form-control', true)
				.attr('placeholder', 'Email address')
				.attr('required', '')
				.attr('autofocus', '')
				.on('input', function() { _this.checkenabled(); })
				.node();
		
		var signInSuccess = function(data)
		{
			cr.signedinUser.updateFromChangeData(data);
			cr.signedinUser.promiseCells(["_system access"])
				.then(function()
					{
						_this.hideRight(function()
							{
								crp.pushInstance(cr.signedinUser);
								$(cr.signedinUser).trigger("signin.cr");
								unblockClick();
							});
					
					},
					cr.syncFail);
		}
		
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
									_this.submit(signInSuccess, cr.syncFail);
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
			.text("Cancel")
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
							_this.submit(signInSuccess, cr.syncFail);
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
	ForgotPasswordPanel.prototype = new SitePanel();
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
			.text("Cancel")
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