var WelcomeTagSearchView = (function () {
	WelcomeTagSearchView.prototype = Object.create(TagSearchView.prototype);
	WelcomeTagSearchView.prototype.constructor = WelcomeTagSearchView;
	
	/* Block moveToNewInput in TagSearchView */
	WelcomeTagSearchView.prototype.transferFocusAfterClick = function(moveToNewInput, d)
	{
		var sitePanel = $(this.container.node()).parents('.site-panel').get(0).sitePanel;
		if (moveToNewInput)
		{
			sitePanel.showSignup();
			sitePanel.emailInput.focus();
		}
		else
		{
			sitePanel.hideSignup();
			TagSearchView.prototype.transferFocusAfterClick.call(this, false, d);
		}
	}
	
	WelcomeTagSearchView.prototype.appendFlags = function(data)
	{
		TagSearchView.prototype.appendFlags.call(this, data);
		this.addOtherFlagNode();
		return this.flags();
	}
	
	function WelcomeTagSearchView(container, poolSection, controller)
	{
		TagSearchView.call(this, container, poolSection, controller);
	}
	
	return WelcomeTagSearchView;
})();

var PromptPanel = (function() {
	PromptPanel.prototype.tagPoolSection = null;
	
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	PromptPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		return false;
	}
	
	PromptPanel.prototype.onFocusInTagInput = function(tagPoolSection, inputNode)
	{
		tagPoolSection.setTagColor(inputNode);
			
		tagPoolSection.checkTagInput(inputNode);
		var datum = d3.select(inputNode).datum();
		var service = datum && datum.service();
		if (!service || tagPoolSection.searchView.hasSubService(service))
			tagPoolSection.searchView.constrainTagFlags(inputNode);
	}
	
	PromptPanel.prototype.fillTags = function()
	{
		var inputNode = this.tagPoolSection.tagsContainer.select('input.tag').node();
		this.tagPoolSection.revealSearchView(inputNode, false);
	}
	
	PromptPanel.prototype.hideClearButton = function(duration)
	{
		var button = this.clearButton;
		
		if (duration === 0)
			button.style('opacity', 0)
				  .style('display', 'none');
		else
		{
			if (button.style('display') != 'none')
			{
				button.interrupt().transition()
					.style('opacity', 0)
					.each('end', function()
						{
							button.style('display', 'none');
						});
			}
		}
	}
	
	PromptPanel.prototype.showClearButton = function()
	{
		var button = this.clearButton;
		if (button.style('display') == 'none')
		{
			button.style('display', null);
			button.interrupt().transition()
				.style('opacity', 1);
		}
	}
	
	function PromptPanel(sitePanel, container, title, prompt, timeframe)
	{
		var _this = this;
		this.div = container.append('panel');
		this.titleDiv = this.div.append('div')
			.classed('title', true)
			.text(title);
		
		var controller = new FirstExperienceController();
		controller.newInstance().timeframe(timeframe);
		
		this.tagPoolSection = new TagPoolSection(this.div, controller, prompt, WelcomeTagSearchView);
		this.tagPoolSection.appendTag(null, "");
		var inputTag = this.tagPoolSection.tagsContainer.select('input.tag').attr('readonly', 'readonly');
		this.clearButton = this.tagPoolSection.tagsContainer.append('span')
			.classed('remove-tag', true)
			.text(crv.buttonTexts.deletemark)
			.on('click', function()
				{
					inputTag.node().value = "";
					$(inputTag.node()).trigger('input');
					inputTag.node().focus();
				});
		this.hideClearButton(0);
				
		var tagsChanged = function()
		{
			try
			{
				if (inputTag.node().value)
					_this.showClearButton();
				else
					_this.hideClearButton();
			}
			catch(err)
			{
				cr.asyncFail(err);
			}
		}
		$(this.tagPoolSection).on('tagsChanged.cr', this.div, tagsChanged);
		

		var tagsFocused = function()
			{
				try
				{
					_this.onFocusInTagInput(this, this.searchView.focusNode);
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			}
		$(this.tagPoolSection).on('tagsFocused.cr', this.div, tagsFocused);
		$(this.div.node()).on('clearTriggers.cr remove', null, this.tagPoolSection, 
			function(eventObject)
				{
					$(_this.tagPoolSection).off('tagsChanged.cr', tagsChanged);
					$(_this.tagPoolSection).off('tagsFocused.cr', tagsFocused);
				});
		$(this.div.node()).on('click', function()
					{
						sitePanel.hideSignup();
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
	
	WelcomePanel.prototype.alignLeft = function()
	{
		var child = this.currentPromptPanelNode();
		var newScrollLeft = parseInt($(child).css('left')) - 2 * this.promptMargin();
		
		$(this.promptScrollArea.node()).animate({scrollLeft: '{0}px'.format(newScrollLeft)}, {duration: 200});
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
			this.summaryReveal.hide({duration: 400, step: f});
			this.signupReveal.show({duration: 400, step: f});
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
			this.signupReveal.hide({duration: 400, step: f});
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
							else if (_this.currentPromptPanelNode() != _this.startPromptPanelNode)
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
				pp.tagPoolSection.searchView.layoutFlags(undefined, 0);
			});
			
		$(lastChild)
			.outerWidth(margin);
	}
 	
	WelcomePanel.prototype.getBottomNavHeight = function()
	{
		return this.searchPanel ? $(this.searchPanel.topBox).outerHeight(false) : 0;
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
			new PromptPanel(this, this.promptScrollArea, "Set a Goal and Achieve It", "My goal is", 'Goal'),
			new PromptPanel(this, this.promptScrollArea, "Discover Opportunities", "An experience I want to have", 'Goal'),
			new PromptPanel(this, this.promptScrollArea, "Figure Out How to Tell Your Story", "An experience I have had", 'Previous'),
			new PromptPanel(this, this.promptScrollArea, "Help Guide Others From Your Real Experiences", "An experience I have had", 'Previous'),
			];
		this.currentPromptIndex = 0;
		this.promptScrollArea.append('panel');
		
		var expandPromptPanel = function()
			{
				_this.hideSummary();
			}
		
		this.promptPanels.forEach(function(pp)
			{
				var $div = $(pp.div.node());
				$div.on('click', function()
				{
					if (this != _this.currentPromptPanelNode())
					{
						var newLeft = parseInt($(this).css('left')) - 2 * _this.promptMargin();
						_this.showSummary();
						$(_this.promptScrollArea.node()).animate({scrollLeft: newLeft},
							{duration: 400}).promise();
					}
				});
				
				$(pp.tagPoolSection).on('tagsFocused.cr', expandPromptPanel);
			});
		
		var currentPromptPanel = this.promptPanels[this.currentPromptIndex];
		currentPromptPanel.tagPoolSection.fillTags()
			.then(function()
				{
					promises = [];
					for (var i = 0; i < _this.promptPanels.length; ++i)
					{
						if (i != _this.currentPromptIndex)
						{
							promises.push(_this.promptPanels[i].tagPoolSection.fillTags());
						}
					}
					return $.when.apply(null, promises)
						.then(function()
							{
								try
								{
								for (var i = 0; i < _this.promptPanels.length; ++i)
								{
									var tagPoolSection = _this.promptPanels[i].tagPoolSection;
									var inputNode = tagPoolSection.tagsContainer.select('input.tag').node();
									tagPoolSection.searchView.constrainTagFlags(inputNode);
								}
								}
								catch (err)
								{
									cr.asyncFail(err);
								}
							},
							cr.asyncFail);
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
					var controller = this.promptPanels[this.currentPromptIndex].tagPoolSection.controller;
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
		
		this.emailInput = emailGroup.append('input')
			.classed('email feedback-control', true)
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
			.classed('feedback-control', true)
			.attr('type', 'password')
			.attr('placeholder', "New password")
			.on('input', function() { _this.checkenabled(); })
			.node();
		this.passwordOK = passwordGroup.append('span')
			.classed("success-feedback", true)
			.node();
		
		var confirmGroup = div.append('div');
		this.confirmGroup = confirmGroup.node();
		var confirmLabel = confirmGroup.append('label')
			.attr('for', 'id_confirmNewPassword')
			.classed('control-label sr-only', true)
			.text("Confirm New Password");
		this.confirmInput = confirmGroup.append('input')
			.attr('id', 'id_confirmNewPassword')
			.classed('feedback-control', true)
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
			.classed("success-feedback", true)
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
			this.signupButton.classed("site-disabled-text", true)
				.classed("site-active-text", false);
		}
		else
		{
			this.signupButton.classed("site-disabled-text", false)
				.classed("site-active-text", true);
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
		
		if ($(this.passwordInput).val() &&
			$(this.passwordInput).val().length >= 6)
		{
			this.passwordOK.textContent = crv.buttonTexts.checkmark;
		}
		else
		{
			submitEnabled = false;
			this.passwordOK.textContent = "";
		}
		
		if ($(this.confirmInput).val() &&
			$(this.passwordInput).val() == $(this.confirmInput).val())
		{
			this.confirmOK.textContent = crv.buttonTexts.checkmark;
		}
		else
		{
			submitEnabled = false;
			this.confirmOK.textContent = "";
		}
	}
	
	function WelcomePanel(onPathwayCreated) {
		var _this = this;
		this.createRoot(null, "Welcome", "welcome");
		var navContainer = this.appendNavContainer();

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
			var pathwayPanel = new PathlinesPanel(cr.signedinUser, false);
			pathwayPanel.setupSearchPanel();
			cr.signedinUser.promiseData(['path'])
				.then(function()
					{
						var promise = pathwayPanel.pathtree.setUser(cr.signedinUser.path(), true);
						pathwayPanel.showLeft().then(
							function()
							{
								if (onPathwayCreated)
									onPathwayCreated(pathwayPanel);
							});
						return promise;
					})
				.then(function()
					{
						pathwayPanel.checkShowIdeas();
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
				/* Set up scrolling in a timeout after the scrolling caused by the
					above code is handled. 
				 */
				setTimeout(function()
					{
						for (i = 0; i < _this.promptPanels.length; ++i)
						{
							_this.promptPanels[i].fillTags();
						}
						$(_this.promptScrollArea.node()).on('scroll', _this._getLeftAlignmentFunction(function()
							{
							}))
							.on('mousedown', function()
								{
									_this.startPromptPanelNode = _this.currentPromptPanelNode();
								});
					})
			});
	}
	
	return WelcomePanel;
})();

