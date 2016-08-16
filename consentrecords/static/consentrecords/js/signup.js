var Signup = (function () {
	Signup.prototype.dots = null;

	Signup.prototype.checkUnusedEmail = function(email, successFunction, failFunction) {
		bootstrap_alert.show($('.alert-container'), "Checking Email Address...<br>(this may take a minute)", "alert-info");

		$.post(cr.urls.checkUnusedEmail, 
			{ email: email,
			})
		  .done(function(json, textStatus, jqXHR)
			{
				closealert();
				if (successFunction)
					successFunction();
			})
		  .fail(function(jqXHR, textStatus, errorThrown) {
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			});
	}
			
	Signup.prototype.submit = function(username, password, initialData, successFunction, failFunction)
	{
		bootstrap_alert.show($('.alert-container'), "Signing up...<br>(this may take a minute)", "alert-info");

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

	function Signup(previousPanel, editable) {
	
		var _thisSignup = this;
		var sitePanel = new SitePanel(previousPanel, null, "Sign Up for Consent Records", "sign-up", revealPanelUp);

		var navContainer = sitePanel.appendNavContainer();

		var panel2Div = sitePanel.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		this.dots = new DotsNavigator(panel2Div, 4);
		this.dots.datum = this;	
		this.dots.finalText = "Create";	

		this.dots.appendForwardButton(navContainer, function()
			{
				var birthDay = _thisSignup.getBirthday();
				var birthMonth = birthDay.substr(0, 7);
				var initialData = {"Birthday": [{text: birthDay}],
				                   "More Experiences": 
				                   		[{cells: {"Birthday": [{text: birthMonth}] }}
				                   		]};
				if (_thisSignup.getPublicAccess())
					initialData["_public access"] = [{instanceID: _thisSignup.getPublicAccess()}];
				_thisSignup.submit(_thisSignup.getEmail(), _thisSignup.getPassword(), 
					initialData, 
					function(userData)
					{
						cr.signedinUser.updateFromChangeData(userData);
						cr.signedinUser.checkCells(["_system access"], function()
							{
								$("#id_sign_in_panel").hide("slide", {direction: "right"}, 0);
								sitePanel.hidePanelDown(
									function()
									{
										$(cr.signedinUser).trigger("signin.cr");
										unblockClick();
									});
							},
						syncFailFunction);
					},
					syncFailFunction)
				
			});
		this.dots.appendBackButton(navContainer, function() {
			sitePanel.hidePanelDown(unblockClick);
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
			var pickedItem = Math.round($(listNode).scrollTop() / itemHeight) + 3;
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
				
// 			p.append('p')
// 				.text('We may collect the day of your birthday later, depending on our partners who provide opportunities to you.');
// 				
			var minYear, maxYear;
			maxYear = (new Date()).getUTCFullYear();
	
			minYear = maxYear-100;
		
			var years = [' ', ' ', ' '];
			for (var i = maxYear; i >= minYear; --i)
				years.push(i);
			years = years.concat([' ', ' ', ' ', ]);
			
			yearPickerList.selectAll('li')
				.data(years)
				.enter()
				.append('li')
				.text(function(d) { return d; });
					
			var months = [' ', ' ', ' ', ].concat(Date.CultureInfo.monthNames)
				.concat([' ', ' ', ' ', ]);
			
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
				monthInput.text("{0}-{1}".format(y, m));
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
			
			crp.getData({path: '_term[_name=_privilege]', 
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
	
		this.dots.nthPanel(0).onReveal = setupPanel0;
		this.dots.nthPanel(1).onReveal = setupPanel2;
		this.dots.nthPanel(2).onReveal = setupPanel3;
		this.dots.nthPanel(3).onReveal = setupPanel4;
		
		showPanelUp(sitePanel.node(), unblockClick);
		this.dots.showDots();
	}
	
	return Signup;
})();
