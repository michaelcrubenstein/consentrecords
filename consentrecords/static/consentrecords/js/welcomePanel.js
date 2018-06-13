var PromptPanel = (function() {
	PromptPanel.prototype = Object.create(FlagStackPanel.prototype);
	
//	PromptPanel.prototype.tagPoolSection = null;
	PromptPanel.prototype.stackLeftMargin = 15;
	PromptPanel.prototype.flagTopMargin = 1.0;	/* em */
	PromptPanel.prototype.flagVSpacing = 1.0;
	PromptPanel.prototype.flagHeightEM = 2.333;
	PromptPanel.prototype.types = ["Job", 
						 "College",
						 "School",
						 "Class", 
						 "Interest", 
						 "Skills", 
						 "Internship", 
						 "Volunteer", 
						 "Exercise", 
						 "Housing", 
						 "Travel"];
	
	PromptPanel.prototype.rootFlagText = function()
	{
		return this.placeholder;
	}
	
	PromptPanel.prototype.isRootService = function(fs)
	{
		return this.types.indexOf(fs.description()) >= 0;
	}
	
	/* Sets the x, y and y2 coordinates of each flag. */
	PromptPanel.prototype._setFlagCoordinates = function(g)
	{
		var _this = this;

		var deltaY = this.flagHeightEM + this.flagVSpacing;
		var nextY = this.flagTopMargin;
		var panelWidth = $(this.flagsContainer.node()).width();
		
		var flagSet = [];
		if (this.serviceStack.length > 1)
		{
			var filterService = this.serviceStack.slice(-1)[0];
			if (filterService == null)	/* The otherFlagNode is at the end. */
				filterService = this.serviceStack.slice(-2)[0];
				
			g.each(function(fd)
				{
					if (fd.visible === undefined || fd.visible)
					{
						if (this == _this.otherFlagRowNode)
						{
							if (_this.flagStack.slice(-2)[0] == _this.rootFlagRowNode &&
								filterService == null)
							{
								d3.select(_this.otherFlagNode)
									.text("Other");
								PathGuides.fillOtherNode(_this.otherFlagNode);
							}
							else
							{
								d3.select(_this.otherFlagNode)
									.text("Other {0}".format(filterService.description()));
								PathGuides.fillNode(_this.otherFlagNode, filterService.getColumn());
							}
							/* Ensure the row is visible before calculating the width */
							$(_this.otherFlagRowNode).css('display', '');
							fd.firstChildWidth = $(_this.otherFlagNode).outerWidth(true);
							
							if (_this.flagStack.slice(-1)[0] != _this.otherFlagRowNode)
								flagSet.push(this);
						}
						else if (_this.flagStack.indexOf(this) < 0)
							flagSet.push(this);
					}
				});
		}
		else
		{
			g.each(function(fd)
				{
					if (this != _this.rootFlagRowNode &&
						(fd.visible === undefined || fd.visible))
						flagSet.push(this);
				});
			d3.select(_this.otherFlagNode)
				.text("Other");
			PathGuides.fillOtherNode(_this.otherFlagNode);
			/* Ensure the row is visible before calculating the width */
			$(_this.otherFlagRowNode).css('display', '');
			var fd = d3.select(_this.otherFlagNode).datum();
			fd.firstChildWidth = $(_this.otherFlagNode).outerWidth(true);
		}

		/* Set the positions of the top row of flags. */	
		var lastX = 0;
		var flagSetFirstX = this.stackLeftMargin;
		for (var i = 0; i < this.serviceStack.length; ++i)
		{
			var flag = this.flagStack[i];
			var fd = d3.select(flag).datum();
			$(flag).css('display', '');
			if (lastX + fd.firstChildWidth > panelWidth && lastX > this.stackLeftMargin)
			{
				lastX = this.stackLeftMargin;
				flagSetFirstX = this.stackLeftMargin * 2;
				nextY += deltaY;
			}
			fd.x = lastX;
			fd.y = nextY;
			lastX += fd.firstChildWidth + this.stackLeftMargin;
		}

		nextY += deltaY;
		lastX = flagSetFirstX;
		
		flagSet.forEach(function(gNode)
			{
				var fd = d3.select(gNode).datum();
				$(gNode).css('display', '');
				if (lastX + fd.firstChildWidth > panelWidth && lastX > flagSetFirstX)
				{
					lastX = flagSetFirstX;
					nextY += deltaY;
				}
				fd.x = lastX;
				fd.y = nextY;
				lastX += fd.firstChildWidth + _this.stackLeftMargin;
			});
	}
	
	/* Block moveToNewInput in TagSearchView */
	PromptPanel.prototype.transferFocusAfterClick = function(moveToNewInput, d)
	{
		var sitePanel = $(this.flagsContainer.node()).parents('.site-panel').get(0).sitePanel;
		if (moveToNewInput)
		{
			sitePanel.emailInput.focus();
			return sitePanel.showSignup();
		}
		else
		{
			return sitePanel.hideSignup();
		}
	}
	
	PromptPanel.prototype.handleClickFlag = function(currentFlag, d)
	{
		if (prepareClick('click', d ? d.description() : 'welcome panel'))
		{
			try
			{
				var _this = this;
				
				if (this.rootFlagRowNode == currentFlag)
				{
					while (this.flagStack.length > 1)
						this._popFlag();
					this._filterFlags();
					this._setFlagCoordinates(this.flagRows);
					this.moveFlags()
						.then(unblockClick, cr.syncFail);
					
					this.transferFocusAfterClick(this.flagStack.length > 1);
				}
				/* If the user clicked on a flag at the top, pop it. */
				else if (this.flagStack.indexOf(currentFlag) >= 0)
				{
					var numFlags = _this.flagStack.indexOf(currentFlag) + 1;
					if (numFlags == _this.flagStack.length)
						--numFlags;

					this.transferFocusAfterClick(numFlags > 1)
						.then(function()
						{
							var flag = null;
							while (_this.flagStack.length > numFlags)
							{
								flag = _this._popFlag();
							}
							
							if (flag)
							{
								_this._filterFlags();
								_this._setFlagCoordinates(_this.flagRows);
								_this.moveFlags()
									.then(unblockClick, cr.syncFail);
							}
							else
								unblockClick();
						},
						cr.syncFail)
				}
				else if (d)
				{
					this._pushFlag(currentFlag, d.service);
					this._filterFlags();
					this._setFlagCoordinates(this.flagRows);
					this.moveFlags()
						.then(unblockClick, cr.syncFail);
					this.transferFocusAfterClick(true);
				}
			}
			catch (err)
			{
				cr.syncFail(err);
			}
		}
	}
	
	PromptPanel.prototype.controller = function()
	{
		/* Make sure the newInstance of the controller has at most one experience. */
		var filterService = this.serviceStack.slice(-1)[0];
		if (filterService == null)	/* The otherFlagNode is at the end. */
			filterService = this.serviceStack.slice(-2)[0];
		
		if (filterService)
		{
			if (this._controller.newInstance().experienceServices().length > 0)
				this._controller.newInstance().experienceServices()[0].service(filterService)
			else
				this._controller.addService(filterService);
		}
		else
		{
			if (this._controller.newInstance().experienceServices().length > 0)
				this._controller.newInstance().experienceServices().pop();
		}
		return this._controller;
	}
	
	PromptPanel.prototype.appendTagPoolSection = function()
	{
		this._controller = new FirstExperienceController();
		this._controller.newInstance().timeframe(this.timeframe);
		
		var _this = this;
		this.titleDiv = this.div.append('div')
			.classed('title', true)
			.text(this.title)
			.style('opacity', 0);
		$(this.titleDiv.node()).animate({opacity: 1}, {duration: 700});
		
		this.flagsContainer = this.div.append('div')
			.classed('flags-container', true);
			
		this.createFlags();
		
		return $.when(this.promise,
					  this.startupImageNode ? 
						  $(this.startupImageNode).animate({top: $(this.startupImageNode.parentNode).innerHeight()},
													  {duration: 700})
							  .promise()
							  .then(function()
									{
										$(_this.startupImageNode.parentNode).remove();
										_this.startupImageNode = null;
									}) :
							function() { 
								_this.canShowStartupImage = false; 
								return null;
							}()
					  );
	}
	
	function PromptPanel(sitePanel, container, title, placeholder, timeframe)
	{
		var _this = this;
		this.div = container.append('panel');
		this.title = title;
		this.placeholder = placeholder;
		this.timeframe = timeframe;
		
		var startupContainer = this.div.append('div')
			.classed('startup', true);
		
		this.canShowStartupImage = true;
		this.startupImageNode = null;
		
		setTimeout(function()
			{
				var logoPath = staticPath + 'consentrecords/svg/logoface.svg';
				var xhr = new XMLHttpRequest();
				xhr.open("GET",logoPath, true);
				xhr.onreadystatechange = function () {
					if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
						if (_this.canShowStartupImage)
						{
							_this.startupImageNode = startupContainer.node()
								.appendChild(xhr.responseXML.documentElement);
						}
					}
				};

				// Following line is just to be on the safe side;
				// not needed if your server delivers SVG with correct MIME type
				xhr.overrideMimeType("image/svg+xml");
				xhr.send("");
		  });
		
		$(this.div.node()).on('click', function()
					{
						_this.transferFocusAfterClick(_this.flagStack.length > 1);;
					});
	}
	
	return PromptPanel;
})();

var PromptPanelSet = (function() {
})();

var WelcomePanel = (function () {
	WelcomePanel.prototype = Object.create(crv.SitePanel.prototype);
	WelcomePanel.prototype.constructor = WelcomePanel;
	
	WelcomePanel.prototype.promptMargin = function()
	{
		return 1.5 * parseInt($(this.mainDiv.node()).css('font-size'));
	}
	
	WelcomePanel.prototype.promptBottomMargin = function()
	{
		return 2 * parseInt($(this.mainDiv.node()).css('font-size'));
	}
	
	WelcomePanel.prototype.currentPromptPanelNode = function()
	{
		var node = this.promptScrollArea.node();
		var children = $(node).children();
		var scrollLeft =  $(node).scrollLeft();
		var margin = this.promptMargin();
		
		var itemClicked;
		for (var i = 0; i < children.length - 1; ++i)
		{
			var child = children.get(i);
			var left = parseInt($(child).css('left')) - 2 * margin;
			if (left <= scrollLeft)
				itemClicked = child;
			else if (left < scrollLeft + Math.round($(node).width()/2))
				return child;
			else
				return itemClicked;
		}
		return itemClicked;	/* The last child */
	}
	
	WelcomePanel.prototype.alignLeft = function(child, duration)
	{
		child = (child !== undefined) ? child : this.currentPromptPanelNode();
		duration = (duration !== undefined) ? duration : 200;
		
		var newScrollLeft = parseInt($(child).css('left')) - 2 * this.promptMargin();
		
		$(this.promptScrollArea.node()).animate({scrollLeft: '{0}px'.format(newScrollLeft)}, {duration: duration});
	}
	
	WelcomePanel.prototype.onResizePrompts = function()
	{
		$(this.promptScrollArea.node()).height(
				$(this.promptContainer.node()).height() - this.promptBottomMargin()
			);
	}
	
	WelcomePanel.prototype.showSummary = function()
	{
		var _this = this;
		if (!this.summaryReveal.isVisible())
		{
			var f = function()
					{
						_this.onResizePrompts();
					}
			this.summaryReveal.show({duration: 400, step: f});
			this.signupReveal.hide({duration: 400, step: f});
		}
	}

	WelcomePanel.prototype.hideSummary = function()
	{
		var _this = this;
		if (this.summaryReveal.isVisible())
		{
			var f = function()
					{
						_this.onResizePrompts();
					}
			this.summaryReveal.hide({duration: 400, step: f});
		}
	}
	
	WelcomePanel.prototype.showSignup = function()
	{
		var _this = this;
		if (!this.signupReveal.isVisible())
		{
			var f = function()
					{
						_this.onResizePrompts();
					}
			return $.when(this.summaryReveal.hide({duration: 400, step: f}),
						  this.signupReveal.show({duration: 400, step: f}));
		}
		else
		{
			var r2 = $.Deferred();
			r2.resolve();
			return r2;
		}
	}

	WelcomePanel.prototype.hideSignup = function()
	{
		var _this = this;
		if (this.signupReveal.isVisible())
		{
			var f = function()
					{
						_this.onResizePrompts();
					}
			return this.signupReveal.hide({duration: 400, step: f});
		}
		else
		{
			var r2 = $.Deferred();
			r2.resolve();
			return r2;
		}
	}

	WelcomePanel.prototype._getLeftAlignmentFunction = function(done)
	{
		var timeout = null;
		var _this = this;
		return function()
			{
				clearTimeout(timeout);
				if (!_this.didDrag)
				{
					timeout = setTimeout(function()
						{
							_this.alignLeft();
							if (document.activeElement == 
								$(_this.currentPromptPanelNode()).find('input').get(0))
								_this.hideSummary();
							else if (_this.currentPromptPanelNode() != _this.startPromptPanelNode &&
								_this.currentPromptPanelNode().promptPanel.flagStack.length == 1)
								_this.showSummary();
						}, 110);
				}
			}
	}
	
    WelcomePanel.prototype._setupDrag = function(node)
    {
		var offsetX;
		var startScrollLeft;
		var _this = this;
		d3.select(node).attr('draggable', 'true')
			.call(
				d3.behavior.drag()
					.on("dragstart", function(){
						try
						{
							var offset = d3.mouse(this);
							offsetX = offset[0];
							_this.startPromptPanelNode = _this.currentPromptPanelNode();
							startScrollLeft = $(this).scrollLeft();
							_this.didDrag = false;
						}
						catch(err)
						{
							console.log(err);
						}
					})
					.on("drag", function(){
						_this.didDrag = true;
						$(node).scrollLeft(startScrollLeft + offsetX - d3.mouse(this)[0]);
					})
					.on("dragend", function(fd, i){
						if (_this.didDrag)
						{
							_this.didDrag = false;
							$(node).scroll();
							if (_this.currentPromptPanelNode() != _this.startPromptPanelNode)
								_this.showSummary();
						}
					})
				);
    }
    
	WelcomePanel.prototype.handleResize = function()
	{
		var _this = this;
		var $mainDiv = $(this.mainDiv.node());
		
		var margin = this.promptMargin();
		this.onResizePrompts();

		var firstChild = $(this.promptScrollArea.node()).children('panel').get(0);
		var lastChild = $(this.promptScrollArea.node()).children('panel:last-of-type').get(0);
		var left = 2 * margin;
		$(this.promptScrollArea.node()).children('panel').each(function()
			{
				var $this = $(this);
				$this.outerWidth($mainDiv.width() - 4 * margin);
				$this.css('left', left).css('top', 0);
				left += $mainDiv.width() - 3 * margin;
			});
			
		this.promptPanels.forEach(function(pp)
			{
				if (pp.flagsContainer)
					pp.layout(0);
			});
			
		$(lastChild)
			.outerWidth(margin);
	}
 	
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	WelcomePanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.goalTagPoolSection.reveal() &&
			this.goalTagPoolSection.reveal().isVisible())
		{
			this.goalTagPoolSection.checkTagInput(null);
			this.goalTagPoolSection.hideReveal(done);
			return true;
		}
		else if (newReveal != this.experienceTagPoolSection.reveal() &&
			this.experienceTagPoolSection.reveal().isVisible())
		{
			this.experienceTagPoolSection.checkTagInput(null);
			this.experienceTagPoolSection.hideReveal(done);
			return true;
		}
		else
			return false;
	}
	
	WelcomePanel.prototype.summaryText1 = "Each of us has a unique path.";
	WelcomePanel.prototype.summaryText2 = "PathAdvisor powers a community to help you figure out your path and discover more possibilities for a meaningful life.";
	WelcomePanel.prototype.summaryText3 = "Let's get started!"
	
	WelcomePanel.prototype.appendSummarySection = function()
	{
		this.summaryContainer = this.mainDiv.append('div')
			.classed('summary', true);
			
		var div = this.summaryContainer.append('div');
			
		div.append('p')
			.text(this.summaryText1);
		div.append('p')
			.text(this.summaryText2);
		div.append('p')
			.text(this.summaryText3);
			
		this.summaryReveal = new VerticalReveal(this.summaryContainer.node());
		this.summaryReveal.show();
	}
	
	WelcomePanel.prototype.appendPromptSections = function()
	{
		var _this = this;
		
		this.promptContainer = this.mainDiv.append('div')
			.classed('prompts', true);
		this.promptScrollArea = this.promptContainer.append('div')
			.classed('scrollArea', true);
			
		this.promptPanels = [
			new PromptPanel(this, this.promptScrollArea, "What is Your Goal?", "My goal is...", 'Goal'),
			new PromptPanel(this, this.promptScrollArea, "What Opportunity Do You Need?", "An experience I want is...", 'Goal'),
			new PromptPanel(this, this.promptScrollArea, "What is Your Story?", "An experience I have had is...", 'Previous'),
			new PromptPanel(this, this.promptScrollArea, "What Could Others Learn from Your Experiences?", "An experience I have had is...", 'Previous'),
			];
		this.promptScrollArea.append('panel');
		
		var currentPromptPanel = this.promptPanels[this.currentPromptIndex];
		
		ServiceFlagController.controllersPromise()
			.then(function()
				{
					promises = [];
					
					for (var i = 0; i < _this.promptPanels.length; ++i)
					{
						var pp = _this.promptPanels[i];
						
						var $div = $(pp.div.node());
						$div.on('click', function()
						{
							if (this != _this.currentPromptPanelNode())
							{
								var newLeft = parseInt($(this).css('left')) - 2 * _this.promptMargin();
								$(_this.promptScrollArea.node()).animate({scrollLeft: newLeft},
									{duration: 400}).promise();
							}
						});
				
						pp.div.node().promptPanel = pp;
						
						promises.push(pp.appendTagPoolSection());
					}
					return $.when.apply(null, promises);
				},
				cr.asyncFail);
				
		this._setupDrag(this.promptScrollArea.node());
	}
	
	WelcomePanel.prototype.getEmail = function()
	{
		return this.emailInput.value;
	}
	
	WelcomePanel.prototype.getPassword = function()
	{
		return this.passwordInput.value;
	}
	
	WelcomePanel.prototype.submit = function(username, password, initialData)
	{
		bootstrap_alert.show($('.alert-container'), "Signing up...\n(this may take a minute)", "alert-info");

		return $.post(cr.urls.submitNewUser, 
			{ username: username,
				password: password,
				properties: JSON.stringify(initialData)
			})
		  .then(function(json, textStatus, jqXHR)
			{
				bootstrap_alert.close();
				var r2 = $.Deferred();
				r2.resolve(json.user);
				return r2;
			}, cr.thenFail);
	}

	WelcomePanel.prototype.submitSignin = function()
	{
		if (prepareClick('click', 'Welcome Sign Up'))
		{
			try
			{
				function validateEmail(email) 
				{
					var re = /\S+@\S+\.\S\S+/;
					return re.test(email);
				}
		
				var password = this.getPassword();
				if (!this.getEmail())
				{
					cr.syncFail("The email address is required.");
					this.emailInput.focus();
				}
				else if (!validateEmail(this.getEmail()))
				{
					cr.syncFail("The email address is not in a recognized format.");
					this.emailInput.focus();
				}
				else if (password.length < 6)
				{
					cr.syncFail("The password is less than six characters.");
					this.passwordInput.focus();
				}
				else if (this.confirmInput.value != password)
				{
					cr.syncFail("The password and the password verification do not match.");
					this.confirmInput.focus();
				}
				else
				{
					var _this = this;
					var initialData = {};
					var experienceData = {};
					var controller = this.promptPanels[this.currentPromptIndex].controller();
					if (controller.newInstance().experienceServices().length > 0)
					{
						controller.appendData(experienceData);
						experienceData.add = uuid.v4();
						initialData = {path: {add: uuid.v4(), experiences: [ experienceData ]}};
					}

					this.submit(this.getEmail(), this.getPassword(), 
						initialData)
						.then(function(data)
							{
								return cr.createSignedinUser(data.id);
							}, 
							cr.chainFail)
						.then(function(user)
							{
								try
								{
									_this.hide();
								}
								catch(err)
								{
									cr.syncFail(err);
								}
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
	}

	WelcomePanel.prototype.appendSignupSection = function()
	{
		var _this = this;
		this.signupSection = this.mainDiv.append('div')
			.classed('signup', true);
		
		var div = this.signupSection.append('div');
			
		div.append('div')
			.classed('title', true)
			.text('Create a PathAdvisor Account');
			
		var emailGroup = div.append('div');
		this.emailGroup = emailGroup.node();
		
		var emailLabel = emailGroup.append('label')
			.attr('for', 'id_newEmail')
			.classed('control-label sr-only', true)
			.text("Email Address");

		this.emailInput = emailGroup.append('input')
			.classed('base-input email feedback-control', true)
			.attr('id', 'id_newEmail')
			.attr('placeholder', "Email Address")
			.node();
			
		$(this.emailInput).on('input', function() { _this.checkenabled(); });
		
		this.emailOK = emailGroup.append('span')
			.classed('success-feedback', true)
			.node();
		
		var passwordGroup = div.append('div');
		this.passwordGroup = passwordGroup.node();
		var passwordLabel = passwordGroup.append('label')
			.attr('for', 'id_newPassword')
			.classed('control-label sr-only', true)
			.text("New Password");
		this.passwordInput = passwordGroup.append('input')
			.attr('id', 'id_newPassword')
			.classed('base-input feedback-control', true)
			.attr('type', 'password')
			.attr('placeholder', "New password")
			.on('input', function() { _this.checkenabled(); })
			.node();
		this.passwordOK = passwordGroup.append('span')
			.classed('success-feedback', true)
			.node();
		
		var confirmGroup = div.append('div');
		this.confirmGroup = confirmGroup.node();
		var confirmLabel = confirmGroup.append('label')
			.attr('for', 'id_confirmNewPassword')
			.classed('control-label sr-only', true)
			.text("Confirm New Password");
		this.confirmInput = confirmGroup.append('input')
			.attr('id', 'id_confirmNewPassword')
			.classed('base-input feedback-control', true)
			.attr('type', 'password')
			.attr('placeholder', "Confirm new password")
			.on('input', function() { _this.checkenabled(); })
			.on('keypress', function()
				{
					if (d3.event.which == 13)
					{
						_this.submitSignin();
						d3.event.preventDefault();
					}
				})
			.node();
		this.confirmOK = confirmGroup.append('span')
			.classed('success-feedback', true)
			.node();

		this.signupButton = div.append('div').append('button')
			.classed('signup site-active-text default-link', true)
			.text("Sign Up")
			.on('click', function()
				{
					_this.submitSignin();
					d3.event.preventDefault();
				});
			
		this.signupReveal = new VerticalReveal(this.signupSection.node());
		this.signupReveal.hide();
	}
	
	WelcomePanel.prototype.canSubmit = function() {
		return $(this.passwordInput).val() &&
			$(this.confirmInput).val() &&
			$(this.emailInput).val();
	}

	WelcomePanel.prototype.checkenabled = function() {			
		if (!this.canSubmit())
		{
			this.signupButton.classed('site-disabled-text', true)
				.classed('site-active-text', false);
		}
		else
		{
			this.signupButton.classed('site-disabled-text', false)
				.classed('site-active-text', true);
		}

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
	}
	
	function WelcomePanel(currentPromptIndex) {
		var _this = this;
		this.createRoot(null, "Welcome", "welcome");
		var navContainer = this.appendNavContainer();
		
		this.currentPromptIndex = currentPromptIndex === undefined ? 0 : currentPromptIndex;

		var logo = navContainer.appendLeftButton()
			.append('img')
			.classed('logo', true)
			.attr('src', logoPath);
		navContainer.appendTitle('');
		var signinSpan = navContainer.appendRightButton()
			.on("click", function()
				{
					showClickFeedback(this);
					if (prepareClick('click',  'Sign In button'))
					{
						if (!navigator.cookieEnabled)
							cr.syncFail(new Error(crv.buttonTexts.cookiesRequired));
						else
						{
							try
							{
								var signinPanel = new SigninPanel();
								signinPanel.showLeft().then(
									function()
									{
										signinPanel.initializeFocus();
										unblockClick();
									});
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					}
					d3.event.preventDefault();
				})
			.append('span').text('Sign In');
			
		var panel2Div = this.appendScrollArea();
		panel2Div.classed('vertical-scrolling', false);
		
		this.appendSummarySection();
		
		this.appendPromptSections();
		
		this.appendSignupSection();
		
		this.handleResize();
		
		var signedIn = function(eventObject) {
			ServiceFlagController.clearPromises();
			
			var pathwayPanel = new HomePanel(cr.signedinUser, false);
			cr.signedinUser.promiseData(['path'])
				.then(function()
					{
						var promise = pathwayPanel.pathtree.setUser(cr.signedinUser.path(), true);
						pathwayPanel.showLeft();
						return promise;
					});
			
		};
		
		$(this.mainDiv.node()).on("resize.cr", function()
			{
				_this.handleResize();
			});
		
		cr.signedinUser.on("signin.cr", this.node(), signedIn);
		$(this.node()).on("remove", null, function()
			{
				cr.signedinUser.off("signin.cr", signedIn);
			});
			
		$(this.node()).one('revealing.cr', function()
			{
				$(_this.promptScrollArea.node()).on('scroll', _this._getLeftAlignmentFunction(function()
					{
					}))
					.on('mousedown', function()
						{
							_this.startPromptPanelNode = _this.currentPromptPanelNode();
						});
				
				var currentPromptPanel = _this.promptPanels[_this.currentPromptIndex];
				_this.alignLeft(currentPromptPanel.div.node(), 0);
		
			});
	}
	
	return WelcomePanel;
})();

