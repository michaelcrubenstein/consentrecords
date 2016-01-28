var Signup = (function () {
	Signup.prototype.dots = null;

	Signup.prototype.checkUnusedEmail = function(email, successFunction, failFunction) {
		bootstrap_alert.show($('.alert-container'), "Checking Email Address...<br>(this may take a minute)", "alert-info");

		$.post(cr.urls.checkUnusedEmail, 
			{ csrfmiddlewaretoken: $.cookie("csrftoken"), 
			  email: email,
			})
		  .done(function(json, textStatus, jqXHR)
			{
				if (json.success) {
					closealert();
					if (successFunction)
						successFunction();
				}
				else {
					failFunction(json.error);
				}
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			});
	}
			
	Signup.prototype.submit = function(username, password, initialData, successFunction, failFunction)
	{
		bootstrap_alert.show($('alert-container'), "Signing up...<br>(this may take a minute)", "alert-info");

		$.post(cr.urls.submitNewUser, 
			{ csrfmiddlewaretoken: $.cookie("csrftoken"), 
				username: username,
				password: password,
				properties: JSON.stringify(initialData),
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

	function Signup(previousPanel, editable) {
	
		var _thisSignup = this;
		var sitePanel = new SitePanel(previousPanel, null, "Sign Up for Consent Records", "sign-up");

		var navContainer = sitePanel.appendNavContainer();

		var panel2Div = sitePanel.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		this.dots = new DotsNavigator(panel2Div, 4);
		this.dots.datum = this;		

		this.dots.appendForwardButton(navContainer, function()
			{
				var initialData = {"Birthday": _thisSignup.getBirthday()};
				if (_thisSignup.getPublicAccess())
					initialData["_public access"] = _thisSignup.getPublicAccess();
				_thisSignup.submit(_thisSignup.getEmail(), _thisSignup.getPassword(), 
					initialData, 
					function(userData)
					{
						userInstance.value = userData;
						userInstance.checkCells(undefined, function()
							{
								$("#id_sign_in_panel").hide("slide", {direction: "right"}, 0);
								hidePanelDown(sitePanel.node(), true,
									function()
									{
										userInstance.triggerEvent("signin.cr", userInstance);
									});
							},
						syncFailFunction);
					},
					syncFailFunction)
				
			});
		this.dots.appendBackButton(navContainer);
		
		navContainer.appendTitle('Create a New Account');

		function setupPanel0(p, signup)
		{
			p.append('h1')
				.text('Birthday');
				
			var row = p.append('table').classed('labeled', true)
				.append('tr');
			row.append('td').text('Birth Month and Year');
			var monthInput = row.append('td')
				.append('select')
				.classed('month', true)
				.on('change', function(d)
					{
						signup.dots.checkForwardEnabled();
					});
			var yearInput = row.append('td')
				.classed('year full-width', true)
				.append('select')
				.on('change', function(d)
					{
						signup.dots.checkForwardEnabled();
					});
				
			p.append('p')
				.text('Your birthday will be shared only with the people you want. We collect your birth month and year to help match you to the right opportunities.');
				
			p.append('p')
				.text('We may also collect the day of your birthday later, depending on the requirements of our partners who provide specific opportunities to you.');
				
			var minYear, maxYear;
			maxYear = (new Date()).getFullYear();
	
			minYear = maxYear-100;
		
			var years = ['year'];
			for (var i = maxYear; i >= minYear; --i)
				years.push(i);
			yearInput.selectAll('option')
				.data(years)
				.enter()
				.append('option')
				.text(function(d) { return d; });
					
			var months = ['month'].concat(Date.CultureInfo.monthNames);
			monthInput.selectAll('option')
				.data(months)
				.enter()
				.append('option')
				.text(function(d) { return d; });
				
			signup.getBirthday = function()
			{
				var yearNode = yearInput.node();
				var monthNode = monthInput.node();
				var year = parseInt(yearNode.options[yearNode.selectedIndex].text);
				var month = monthNode.selectedIndex;

				var m = month.toString();
				if (m.length == 1)
					m = "0" + m;
				return year.toString() + "-" + m;
			}
			
			p.node().onGoingForward = function(gotoNext)
			{
				var yearNode = yearInput.node();
				var monthNode = monthInput.node();
				if (monthNode.selectedIndex == 0)
				{
					syncFailFunction("The month is required.");
					monthNode.focus();
				}
				else if (yearNode.selectedIndex == 0)
				{
					syncFailFunction("The year is required.");
					yearNode.focus();
				}
				else
				{
					gotoNext();
				}
			}
			
			p0.append('div')
				.append('a').attr('id', "id_termsOfUseLink")
				.classed("btn btn-link btn-xs", true)
				.text("Terms Of Use")
				.on('click', function() {
		var message = "<p>Information in this system will only be used according to your consent except " +
			" as required by law. By signing up for this system, you consent to allow this system to store" +
			" the information you have entered.</p>";
		$(termsAlert.node()).html('<div class="alert alert-info alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'+message+'</div>');

				});
			
			var termsAlert = p0.append('div')
				.append('div').attr('id', "id_termsAlert");
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
					syncFailFunction('The password and the password verification do not match.');
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
				.text('How much of your data do you want to be publicly available?');
			
			var t = p.append('table').classed('option', true);	
			var row = t.append('tr');
			var cell = row.append('td');
			cell.append('input')
				.attr('type', 'radio')
				.attr('checked', 1)
				.attr('name', 'publicAccess')
				.property('value', 'none')
				.on('change', function()
					{
						var _this = this;
						t.selectAll('input').attr('checked', function() { return (_this === this ? 1 : null); });
					});
			cell.append('span').text('None');
			row.append('td').append('p').text('No one will be able to locate or identify you.');

			row = t.append('tr');
			cell = row.append('td');
			var findInput = cell.append('input')
				.attr('type', 'radio')
				.attr('name', 'publicAccess')
				.property('value', '_find')
				.on('change', function()
					{
						var _this = this;
						t.selectAll('input').attr('checked', function() { return (_this === this ? 1 : null); });
					});
			cell.append('span').text('Email Only');
			row.append('td').append('p').text('Others can search for your email address, which lets them give you private access to their profiles.');

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
			cell.append('span').text('All*');
			row.append('td').append('p').text('Others can find you and look at your information *except for the information you explicitly restrict from view.');

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
			
			crp.getData({path: '_uuname[_uuname=_privilege]', 
						 done: function(newInstances)
							{
								var enumeratorCell = newInstances[0].getCell('enumerator');
								for (var i = 0; i < enumeratorCell.data.length; ++i)
								{
									var d = enumeratorCell.data[i];
									if (d.getDescription() === '_read')
										readInput.property('value', d.getValueID());
									else if (d.getDescription() === '_find')
										findInput.property('value', d.getValueID());
								}
								p.node().onCheckForwardEnabled = undefined;
								signup.dots.checkForwardEnabled();
							},
						fail: asyncFailFunction});
			
			this.onReveal = null;
		}
	
		var p0 = d3.select(this.dots.nthPanel(0));
		setupPanel0(p0, this);
		this.dots.nthPanel(1).onReveal = setupPanel2;
		this.dots.nthPanel(2).onReveal = setupPanel3;
		this.dots.nthPanel(3).onReveal = setupPanel4;

		panel2Div.appendAlertContainer();
		
		showPanelUp(sitePanel.node());
		this.dots.showDots();
	}
	
	return Signup;
})();
