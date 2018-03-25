/* experienceCommentsPanel.js */

var ZoomPanel = (function () {
	ZoomPanel.prototype = Object.create(crv.SitePanel.prototype);
	ZoomPanel.prototype.constructor = ZoomPanel;

	ZoomPanel.prototype.mode = 'revealInput';
	ZoomPanel.prototype.topBox = null;
	ZoomPanel.prototype.inputNode = null;
	ZoomPanel.prototype.cancelButton = null;
	ZoomPanel.prototype.topHandle = null;
	
	ZoomPanel.prototype.clearInput = function()
	{
		$(this.inputNode).val('');
											
		/* Hide and show the input so that the placeholder
			re-appears properly in safari 10 and earlier. */
		$(this.inputNode).hide(0).show(0);
	}
	
	ZoomPanel.prototype.hideInput = function(duration)
	{
		var newTop = $(window).height();
		var _this = this;
		this.mode = 'hideInput';
		return $(this.node()).animate({top: newTop},
								   	  {duration: duration})
			.promise()
			.then(function()
				{
					$(_this.inputNode).css('display', 'none');
				},
				cr.chainFail);

	}
	
	ZoomPanel.prototype.inputHeight = function()
	{
		return $(this.inputNode).outerHeight(true)
		     + $(this.topHandle).outerHeight(true);
	}
	
	ZoomPanel.prototype.revealInput = function(duration)
	{
		$(this.inputNode).attr('rows', 1);
		var newTop = $(window).height() - this.inputHeight();
		
		/* Reset the right margin to the same as the left margin. */
		var inputMarginLeft = parseInt($(this.inputNode).css('margin-left'));
		var inputMarginRight = parseInt($(this.inputNode).css('margin-right'));

		var inputWidth = $(this.inputNode.parentNode).width()
						 - inputMarginLeft + inputMarginRight
						 - $(this.inputNode).outerWidth(true) + $(this.inputNode).outerWidth(false);

			
		var _this = this;
		
		this.mode = 'revealInput';
		$(this.inputNode).css('display', '');
		
		return $.when(
			$(this.node()).animate({'background-color': 'rgba(0, 0, 0, 0)'},
								   {duration: duration}),
			$(this.mainDiv.node()).animate({top: newTop},
										   {duration: duration}),
			$(this.inputNode).animate({width: inputWidth,
									   'margin-right': inputMarginLeft,
									   'border-width': '0px'},
										{duration: duration,
										 done: function()
											{
												_this.clearInput();
											}
										 }),
			$(this.cancelButton).animate({left: inputWidth + (2 * inputMarginLeft),
										  opacity: 0.0},
								   {duration: duration,
								   complete: function()
								   	{
								   		$(_this.cancelButton).css('display', 'none');
								   	}})
			)
			.then(function()
			{
				$(_this.node()).css({top: newTop,
									 height: $(_this.topBox).outerHeight(true)}),
				$(_this.mainDiv.node()).css('top', 0);
			});
	}
	
	/* Returns the top of the revealed panel. */
	ZoomPanel.prototype.revealedTop = function()
	{
		return 0;
	}
	
	ZoomPanel.prototype.checkInputNodeSize = function()
	{
		this.inputNode.style.height = 0;
		this.inputNode.style.height = (this.inputNode.scrollHeight) + 'px';
		var fillSection = $(this.mainDiv.node()).children('section.fill');
		fillSection.height(fillSection.getFillHeight());
	}
	
	ZoomPanel.prototype.revealPanel = function(duration)
	{
		/* Ensure the height of the node and the mainNode are correct. */
		var parentHeight = $(window).height();
		$(this.node()).height(parentHeight);
		$(this.mainDiv.node()).height(parentHeight - this.revealedTop());
		
		this.checkInputNodeSize();
		
		var fillSection = $(this.mainDiv.node()).children('section.fill');
		fillSection.height(fillSection.getFillHeight());

		/* Set the right margin of the search input to 0 and account for this in the inputWidth */
		var parentWidth = $(this.inputNode.parentNode).width();
		var inputMarginLeft = parseInt($(this.inputNode).css('margin-left'));
		var inputMarginRight = parseInt($(this.inputNode).css('margin-right'));
		
		var inputWidth = parentWidth 
						 - $(this.inputNode).outerWidth(true) + $(this.inputNode).outerWidth(false)
						 + inputMarginRight
						 - $(this.cancelButton).outerWidth(true);
						 
		$(this.inputNode).css('display', '');
		$(this.cancelButton).css('display', '');
							   
		var poolTop = $(this.topBox).outerHeight(true) + $(this.stagesDiv).outerHeight(true);				   
		
		var _this = this;

		this.mode = 'revealPanel';
		var oldTop = $(this.node()).css('top');
		$(this.node()).css('top', 0);
		$(this.mainDiv.node()).css('top', oldTop);
		
		return $.when(/* Scroll the parentNode top to 0 so that the inputNode is sure to appear.
						This is important on iPhones where the soft keyboard appears and forces scrolling. */
					$(this.node().parentNode)
						.animate({scrollTop: 0},
								 {duration: duration})
						.promise(),
					$(this.node()).animate({'background-color': 'rgba(128, 128, 128, 0.7)'},
										   {duration: duration}),
					$(this.mainDiv.node())
						.animate({top: this.revealedTop()},
								 {duration: duration})
						 .promise(),
					$(this.inputNode).animate({width: inputWidth,
											   'margin-right': 0,
											   'border-width': '1px',
											   },
										   {duration: duration}),
					$(this.cancelButton).animate({left: inputWidth + inputMarginLeft,
												  opacity: 1.0},
										   {duration: duration}));
	}
	
	ZoomPanel.prototype.onRevealPanel = function()
	{
		unblockClick();
	}
	
	ZoomPanel.prototype.onCancel = function()
	{
		return this.revealInput();
	}
	
	ZoomPanel.prototype.appendInputNode = function(topBox)
	{
		return topBox.append('textarea')
			.attr('placeholder', 'What do you want to ask?')
			.attr('rows', 1)
			.node();
	}
	
	ZoomPanel.prototype.createRoot = function()
	{
		var _this = this;
		crv.SitePanel.prototype.createRoot.apply(this, arguments);
		
		this.mode = 'revealInput';
		
		var mainDiv = this.appendScrollArea();
		
		$(window).resize(function()
			{
				handleResize();
			});
			
		function handleResize()
		{
			if (_this.mode == 'revealPanel')
				_this.revealPanel(0);
			else if (_this.mode == 'revealInput')
				_this.revealInput(0);
			else
				_this.hideInput(0);
		}
		
		$(this.mainDiv.node()).on('resize.cr', handleResize);
		
		var topBox = mainDiv.append('div');
		this.topBox = topBox.node();
		
		var topHandle = topBox.append('div')
			.classed('handle', true);
		this.topHandle = topHandle.node();
		
		var topSVG = topHandle.append('svg')
			.classed('handle', true);
		this.topSVG = topSVG.node();
		
		topSVG.append('path')
			.attr('d', 'M 4 4 l 18 7 l 18 -7');
			
		this.inputNode = this.appendInputNode(topBox);
			
		this.cancelButton = topBox.append('button')
			.classed('cancel', true)
			.text(crv.buttonTexts.cancel)
			.style('display', 'none')
			.node();
			
		$(this.inputNode).focusin(function(event)
			{
				if (_this.mode != 'revealPanel')
				{
					if (prepareClick('focusin', 'inputNode'))
					{
						_this.revealPanel()
							.then(function()
								{
									_this.onRevealPanel();
								});
					}
				}
			})
			.on('input', function(event)
			{
				_this.checkInputNodeSize();
				if (event)
					event.stopPropagation();
			})
			.click(function(event)
			{
				if ($(_this.node()).position().top == 0)
					event.stopPropagation();
			});
			
		$(this.topBox).click(function(event)
			{
				if ($(_this.node()).position().top == 0)
				{
					_this.clearInput();
					_this.checkInputNodeSize();
					_this.parentPanel.resizeCommentsSection();
					_this.revealInput();
				}
				else
				{
					$(_this.inputNode).focus();
				}
				event.stopPropagation();
			});
			
		$(this.cancelButton).click(function(event)
			{
				_this.onCancel();
				
				event.stopPropagation();
			});
			
	}
	
	function ZoomPanel()
	{
		crv.SitePanel.apply(this, []);
	}
	
	return ZoomPanel;
})();

var AskQuestionPanel = (function () {
	AskQuestionPanel.prototype = Object.create(ZoomPanel.prototype);
	AskQuestionPanel.prototype.constructor = ZoomPanel;

	AskQuestionPanel.prototype.askQuestion = function(newText)
	{
		/* Test case: add a comment to an experience that has had a comment */
		var experience = this.fd.experience;
		return cr.signedinUser.promiseData(['path'])
			.then(function()
				{
					return experience.postComment({asker: cr.signedinUser.path().urlPath(),
												   question: newText});
				},
				cr.chainFail);
	}
	
	AskQuestionPanel.prototype.onCancel = function()
	{
		var _this = this;
		var newQuestion = _this.inputNode.value;
		if (newQuestion)
		{
			if (prepareClick('click', 'Ask Question'))
			{
				try
				{
					showClickFeedback(this.cancelButton);
					bootstrap_alert.success("Sending email (this may take a few minutes)...");
					_this.askQuestion(newQuestion)
						.then(function()
							{
								_this.clearInput();
								_this.checkInputNodeSize();
								_this.parentPanel.resizeCommentsSection();
								_this.revealInput();
								_this.parentPanel.showLastComment();
								bootstrap_alert.close();
								unblockClick();
							},
							cr.syncFail);
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
		}
	}
	
	/* Returns the top of the revealed panel. */
	AskQuestionPanel.prototype.revealedTop = function()
	{
		return this.parentPanel.childPanelTop();
	}
	
	function AskQuestionPanel(parentPanel, fd)
	{
		var _this = this;
		ZoomPanel.apply(this, []);
		this.parentPanel = parentPanel;
		this.fd = fd;
		
		this.createRoot(null, "Ask Question", 'zoom question');
		
		this.cancelButton.textContent = "Ask";

		var commentPromptsDiv = this.mainDiv.append('section')
			.classed('comment-prompts', true);
		
		crp.promise({path:  'comment prompt',
					 resultType: cr.CommentPrompt})
		.then(function(prompts)
			{
				commentPromptsDiv.selectAll('div')
					.data(prompts)
					.enter()
					.append('div')
					.append('span')
					.classed('site-active-text', true)
					.text(function(d) 
						{ return d.description(); })
					.on('click', function(d)
						{
							_this.inputNode.value = '';
							_this.inputNode.value = d.description();
							_this.inputNode.focus();
							var textWidth = _this.inputNode.value.length;
							_this.inputNode.setSelectionRange(textWidth, textWidth)
						});
/*				resizeQuestionBoxes(); */
			}, cr.asyncFail);
			
		this.mainDiv.append('section')
			.classed('fill', true);	

		setTimeout(function()
			{
				_this.panelDiv.style('top', "{0}px".format($(window).height()));
				_this.panelDiv.style('display', 'block');
				_this.revealInput();
			});
			
	}
	
	return AskQuestionPanel;
})();

var ExperienceCommentsPanel = (function() {
	ExperienceCommentsPanel.prototype = Object.create(crv.SitePanel.prototype);
	ExperienceCommentsPanel.prototype.constructor = ExperienceCommentsPanel;

	ExperienceCommentsPanel.prototype.fd = null;
	ExperienceCommentsPanel.prototype.inEditMode = false;
	ExperienceCommentsPanel.prototype.detailGroup = null;
	ExperienceCommentsPanel.prototype.detailTextGroup = null;
	ExperienceCommentsPanel.prototype.editChevronContainer = null;
	
	ExperienceCommentsPanel.prototype.editChevronWidth = 12; 	/* pixels */
	ExperienceCommentsPanel.prototype.editChevronHeight = 18; 	/* pixels */
	
	ExperienceCommentsPanel.prototype.youAskedText = "You asked";
	ExperienceCommentsPanel.prototype.someoneAskedText = "{0} asked";
	
	ExperienceCommentsPanel.prototype.appendDescriptions = function(items)
	{
		var divs = items.append('div')
			.classed('growable', true);
		
		var _this = this;
		var askers = divs.append('div')
			.classed('asker', true)
			.datum(function(d) { 
				return d.asker(); })
			.text(function(path) {
					if (!path || !path.id())
						return null;
					if (path.id() == cr.signedinUser.path().id())
						return _this.youAskedText;
					else {
						return _this.someoneAskedText.format(path.caption());
					}
				});

		var questions = divs.append('textarea')
			.classed('question', true)
			.text(function(d) { 
					return d && d.question(); 
				});
				
		var answers = divs.append('textarea')
			.classed('answer', true)
			.text(function(d) { 
					return (d && d.text()); 
				});
		
		if (this.fd.experience.canWrite())
		{
			var replyButtons = divs.append('button')
				.classed('reply site-active-text', true)
				.text("Answer")
				.style('display', function(d)
					{
						if (_this.inEditMode)
							return 'none';
						else
							return (!d || !d.text()) ? null : 'none';
					})
				.on('click', function()
					{
						if (prepareClick('click', 'Edit Experience Comments'))
						{
							try
							{
								_this.startEditing();
								$(this.parentNode).children('.answer').focus();
								unblockClick();
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					});
		}
			
				
		var checkSize = function(eventObject) {
			this.style.height = 0;
			this.style.height = (this.scrollHeight) + 'px';
			this.style.display = (this.value || 
								  this.getAttribute('placeholder') || 
								  (_this.inEditMode && $(this).hasClass('answer')))
								   ? 'inline-block' : 'none';
			if (eventObject)
				eventObject.stopPropagation();
		}
			
		divs.selectAll('textarea.question')
			.attr('readonly', this.inEditMode ? null : 'readonly')
			.classed('editable', this.inEditMode)
			.classed('fixed-immediate', !this.inEditMode)
			.each(function()
				{
					this.setAttribute('style', 'height:0px;overflow-y:hidden;display:inline-block;');
					this.setAttribute('style', 'height:' + (this.scrollHeight) + 'px;overflow-y:hidden;display:inline-block;');
					this.style.display = this.value ? 'inline-block' : 'none';
					$(this).on('input', checkSize);
					$(this).on('resize.cr', checkSize);
					checkSize.call(this, null);
				});
				
		divs.selectAll('textarea.answer')
			.attr('readonly', this.inEditMode ? null : 'readonly')
			.classed('editable', this.inEditMode)
			.classed('fixed-immediate', !this.inEditMode)
			.each(function()
				{
					this.setAttribute('style', 'height:0px;overflow-y:hidden;display:inline-block;');
					this.setAttribute('style', 'height:' + (this.scrollHeight) + 'px;overflow-y:hidden;display:inline-block;');
					this.style.display = 'inline-block';
					$(this).on('input', checkSize);
					$(this).on('resize.cr', checkSize);
					checkSize.call(this, null);
				});
	}
	
	ExperienceCommentsPanel.prototype.checkDeleteControlVisibility = function(items)
	{
		var deleteControls = $(items.node()).parent().find('button.delete');
		if (!this.inEditMode)
			crf.hideDeleteControls(deleteControls, 0);
		else
			crf.showDeleteControls(deleteControls, 0);
	}
	
	ExperienceCommentsPanel.prototype.loadComments = function(data)
	{
		var _this = this;
		var commentList = this.mainDiv.select('section.comments>ol');
		var items = appendItems(commentList, data,
							function(d) {
								if (commentList.selectAll('li').size())
								{
									_this.editButton.style('display', '');
								}
								else
								{
									_this.editButton.style('display', 'none');
									_this.editButton.text(crv.buttonTexts.editComments);
									_this.inEditMode = false;
								}
								_this.resizeCommentsSection();
							});
		
		var deleteControls = crf.appendDeleteControls(items);
		this.appendDescriptions(items);
		crf.appendConfirmDeleteControls(items);

		checkItemsDisplay(commentList.node());
		
		/* Force each item to resize in case the commentList was previously empty and hidden. */
		items.each(function(d) 
			{ 
				$(this).trigger("resize.cr"); 
				$(this).find('textarea').trigger('resize.cr');
			});
		
		this.editButton.style('display', commentList.selectAll('li').size() ? '' : 'none');
		this.checkDeleteControlVisibility(items);
	}
	
	/**
		Checks all of the text areas in the panel to see if their contents have changed. 
		If so, then the changes are saved.
	 */
	ExperienceCommentsPanel.prototype.checkTextAreas = function(done, fail)
	{
		var commentsDiv = this.mainDiv.select('section.comments');
		var changes = [];
		
		commentsDiv.selectAll('li textarea').each(function(d)
			{
				var newValue = this.value.trim();
				if (d)
				{
					if (d.id())
					{
						if (d3.select(this).classed('question') && newValue != d.question())
							changes.push({'id': d.id(), 'question': newValue});
						else if (d3.select(this).classed('answer') && newValue != d.text())
							changes.push({'id': d.id(), 'text': newValue});
					}
				}
			});
		if (changes.length > 0)
			return this.fd.experience.update({'comments': changes});
		else
		{
			var r = $.Deferred();
			r.resolve(null);
			return r;
		}
	}
	
	/**
		Change the UI elements to indicate that this panel is in Edit mode.
	 */
	ExperienceCommentsPanel.prototype.startEditing = function()
	{
		try
		{
			var _this = this;
			var commentList = this.mainDiv.select('section.comments>ol');
			var dials = $(this.node()).find('ol.deletable-items>li>button:first-of-type');
			showClickFeedback(this.editButton.node(), function()
				{
					_this.editButton.text(crv.buttonTexts.done);
				});
			crf.showDeleteControls(dials);
			this.inEditMode = true;
			commentList.classed('edit', true);
			commentList.selectAll('textarea.answer')
				.style('display', null);
			commentList.selectAll('textarea')
				.attr('readonly', null)
				.classed('fixed fixed-immediate', false)
				.classed('editable', true)
				.each(function() { $(this).trigger('resize.cr'); });
			commentList.selectAll('button.reply')
				.style('display', 'none');
		}
		catch(err)
		{
			this.editButton.text(crv.buttonTexts.editComments);
			throw err;
		}
	}
	
	/**
		Sets the keyboard focus to the text of the comment that has the specified 
		Value ID.
	 */
	ExperienceCommentsPanel.prototype.focusOnComment = function(id)
	{
		var commentList = this.mainDiv.select('section.comments>ol');
		var textAreas = $(commentList.node()).children('li')
			.filter(function() {
					return d3.select(this).datum().id() == id;
				});
		if (textAreas.length == 0)
			throw new Error('The specified comment is not recognized.');
			
		var answerTextArea = textAreas
			.find('textarea.answer');
			
		answerTextArea.one('focus', function()
			{
				this.select();

				// Work around Chrome's little problem
				var _this = this;
				this.onmouseup = function() {
					// Prevent further mouseup intervention
					_this.onmouseup = null;
					return false;
				};
			});
		answerTextArea.focus();
	}

	/**
		Displays a panel for editing the description of the experience: its organization,
		site, offering, etc.
	 */
	ExperienceCommentsPanel.prototype.showDetailPanel = function(fd)
	{
		if (fd.experience instanceof cr.Engagement) {
			;	/* Nothing to edit */
		}
		else
		{
			if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
			{
				try
				{
					var experienceController = new ExperienceController(fd.experience.parent(), fd.experience, true);
					experienceController.oldInstance(fd.experience);
					new NewExperiencePanel(experienceController, revealPanelLeft)
						.showLeft()
						.always(unblockClick);
				}
				catch(err)
				{
					cr.syncFail(err);
				}
				d3.event.stopPropagation();
			}
		}
	}
	
	/**
		Deletes any notifications of the currently logged in user that are no longer valid
		for this experience.
		Invalid notifications include crn.ExperienceCommentRequested notifications where
		the comment has been specified.
	 */
	ExperienceCommentsPanel.prototype.clearNotifications = function()
	{
		var _this = this;
		var changes = [];

		if (cr.signedinUser.notifications())
		{
			cr.signedinUser.notifications().forEach(function(n)
				{
					if (n.name() == "crn.ExperienceCommentRequested")
					{
						var args = n.args();
						if (args.length >= 3 && 
							args[1].id() == _this.fd.experience.id())
						{
							var comment = crp.getInstance(args[2].id());
							if (comment && comment.text())
							{
								changes.push({'delete': n.id()});
							}
						}
					}
				});
		}	
		if (changes.length > 0)
		{
			return cr.signedinUser.update({'notifications': changes});
		}
		else
		{
			var r = $.Deferred();
			r.resolve(null);
			return r;
		}
	}
	
	ExperienceCommentsPanel.prototype.childPanelTop = function()
	{
		return $(this.navContainer.nav.node()).outerHeight(true) +
			   $(this.detailGroup.node()).outerHeight(true);
	}
	
	ExperienceCommentsPanel.prototype.setupAsk = function()
	{
		var _this = this;
		var canBeAsked = this.fd.experience.path().canAnswerExperience();
		if (cr.signedinUser.id() && canBeAsked != "no")
		{
			this.askPanel = new AskQuestionPanel(this, this.fd);
			
			$(this.node()).on('hiding.cr', function()
				{
					_this.askPanel.hideRight();
				});
			this.resizeCommentsSection();
/* 
			var resizeQuestionBoxes = function()
				{
					var newQuestionHMargin = ($(newQuestionInput.node()).outerWidth(true) - $(newQuestionInput.node()).width())
					var newQuestionWidth = $(newQuestionDiv.node()).width() - newQuestionHMargin;
					var askWidth = $(askButton.node()).outerWidth(true);
					if (_this.postButtonNode && $(_this.postButtonNode).outerWidth(true) > askWidth)
						askWidth = $(_this.postButtonNode).outerWidth(true);
					newQuestionWidth -= askWidth;
				
					$(newQuestionInput.node()).width(newQuestionWidth);
					commentPromptsDiv
						.style('width', "{0}px".format(newQuestionWidth + newQuestionHMargin));
				}
						
			$(this.mainDiv.node()).on('resize.cr', resizeQuestionBoxes);
 */
			
		}
	}
	
	ExperienceCommentsPanel.prototype.resizeCommentsSection = function()
	{
		var $commentsDiv = $(this.commentsSection);
		var askHeight = this.askPanel ? this.askPanel.inputHeight() : 0;
		$commentsDiv.height($commentsDiv.getFillHeight() - askHeight);
	}
	
	ExperienceCommentsPanel.prototype.showLastComment = function()
	{
		var $commentsDiv = $(this.commentsSection);
		var $lastChild = $commentsDiv.children(':last-child');
		
		var newTop = $lastChild.outerHeight() - $commentsDiv.innerHeight();
		$commentsDiv.animate({scrollTop: newTop});
	}
	
	function ExperienceCommentsPanel(fd, backText)
	{
		this.createRoot(fd, "Experience", "comments", revealPanelLeft);
		this.fd = fd;
		var _this = this;
		
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();

		var backButton = navContainer.appendLeftButton()
			.classed('chevron-left-container', true)
			.on('click', function()
			{
				if (prepareClick('click', 'Experience Comments Done'))
				{
					try
					{
						showClickFeedback(this);
						if (fd.experience.canWrite())
						{
							_this.checkTextAreas()
								.then(function()
									{
										return _this.clearNotifications();
									})
								.then(function()
									{
										_this.hide();
									},
								cr.syncFail);
						}
						else
							_this.hide();
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			});
		appendLeftChevronSVG(backButton).classed('chevron-left', true);
		backButton.append('span').text(backText);

		navContainer.appendTitle('');
		
		this.inEditMode = false;

		var shareButton = navContainer.appendRightButton()
			.on('click', function()
				{
					if (prepareClick('click', 'share'))
					{
						new ExperienceShareOptions(fd.experience, fd.experience.path());
					}
				});
		shareButton.append("img")
			.attr("src", shareImagePath);

		this.mainDiv.classed('vertical-scrolling', false)
			.classed('no-scrolling', true);

		this.detailGroup = this.mainDiv.append('div')
			.classed('banner', true)
			.datum(fd);
		this.detailTextGroup = this.detailGroup.append('div')
			.classed('detail', true);
		
		function resizeDetail()
		{
			fd.appendElements(_this.detailTextGroup, 12);
			if (backText != fd.experience.parent().parent().caption())
			{
				/* Test case: Display an answered question notification detail */
				_this.detailTextGroup.insert('div', ':first-child')
					.classed('user-label', true)
					.text(fd.experience.parent().parent().caption());
			}
		}
		
		function changeEventHandler(eventObject, newValue)
		{
			try
			{
				fd.colorHTMLElement(_this.detailGroup.node());
				fd.colorHTMLElement(navContainer.nav.node());
				resizeDetail();
			}
			catch(err) { cr.asyncFail(err); }
		}
		
		/* Update the contents of the top banner if the contents of the experience are changed. */
		fd.setupChangeEventHandler(this.mainDiv.node(), changeEventHandler);
		
		/* Hide this panel if the experience is deleted */
		setupOneViewEventHandler(fd.experience, "deleted.cr", this.node(), function(eventObject)
			{
				_this.hideNow();
			});

		if (fd.experience.canWrite())
		{
			this.editChevronContainer = appendRightChevronSVG(this.detailGroup);
			$(this.editChevronContainer.node()).width(this.editChevronWidth)
				.height(this.editChevronHeight);
						
			this.detailGroup.on('click', function(e)
				{
					_this.showDetailPanel(fd);
				})
		}
		
		if (fd.experience.canWrite())
		{
			var editCommentsContainer = this.mainDiv.append('div')
				.classed('edit', true);
				
			if (fd.experience.privilege() == 'administer')
			{
				this.sharingButton = editCommentsContainer.append('div').append('span')
					.classed('site-active-text', true)
					.text(crv.buttonTexts.sharing)
					.on('click', function()
						{
							if (prepareClick('click', 'Sharing'))
							{
								var experienceController = new ExperienceController(fd.experience.parent(), fd.experience, true);
								experienceController.oldInstance(fd.experience);
								var panel = new ExperienceSecurityPanel(experienceController, _this.title, revealPanelUp);
								panel.showUp()
									.then(unblockClick, cr.syncFail);
							}
						});
			}
			
			this.editButton = editCommentsContainer.append('div').append('span')
				.on('click', function()
				{
					if (_this.inEditMode)
					{
						if (prepareClick('click', 'Done Edit Experience Comments'))
						{
							/* Store the new text in a button so that it is set properly
								when an error occurs whether or not the callback to showClickFeedback is called. */
							var newButtonText = crv.buttonTexts.editComments;
							var fail = function(err)
								{
									newButtonText = crv.buttonTexts.done;
									_this.editButton.text(newButtonText);
									cr.syncFail(err);
								}
							try
							{
								showClickFeedback(this, function()
									{
										_this.editButton.text(newButtonText);
									});
								_this.checkTextAreas()
									.then(function()
									{
										try
										{
											var dials = $(_this.node()).find('ol.deletable-items>li>button:first-of-type');
											crf.hideDeleteControls(dials);
											_this.inEditMode = false;
											commentList.classed('edit', false);
											commentList.selectAll('textarea.answer')
												.style('display', function() {
														return this.value ? null : 'none';
													});
											commentList.selectAll('textarea')
												.attr('readonly', 'readonly')
												.classed('editable', false)
												.classed('fixed-immediate', false)
												.classed('fixed', true);
											commentList.selectAll('button.reply')
												.style('display', function(d)
													{
														return (!d || !d.text()) ? null : 'none';
													});

											unblockClick();
										}
										catch(err)
										{
											cr.syncFail(err);
										}
									},
									fail);
							}
							catch(err)
							{
								fail(err);
							}
						}
					}
					else
					{
						if (prepareClick('click', 'Edit Experience Comments'))
						{
							try
							{
								_this.startEditing();
								unblockClick();
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					}
				});
			this.editButton
				.classed('site-active-text', true)
				.text(crv.buttonTexts.editComments);
		}

		var commentsDiv = this.mainDiv.append('section')
			.classed('multiple edit comments', true);
		this.commentsSection = commentsDiv.node();
		var commentList = crf.appendItemList(commentsDiv)
			.classed('deletable-items', true);
		commentList.classed('edit', this.inEditMode);
		
		setupOnViewEventHandler(fd.experience, 'commentAdded.cr', commentsDiv.node(), 
			function (eventObject, newData)
				{
					_this.loadComments([newData]);
				});
		
		if (fd.experience.canWrite())
		{
			var newCommentDiv = this.mainDiv.append('section')
				.classed('new-comment', true);
			var newCommentButton = newCommentDiv.append('button')
				.classed('site-active-text add-comment', true)
				.text("Add Comment")
				.on('click', function()
				{
					if (prepareClick('click', 'Add Comment'))
					{
						$(_this.newCommentInputNode).css('display', '');
						$(_this.newCommentButtonNode).css('display', 'none');
						$(_this.newCommentInputNode).trigger('input');
						$(_this.newCommentInputNode).focus();
						unblockClick();
					};
				});
			this.newCommentButtonNode = newCommentButton.node();
				
			var newCommentInput = newCommentDiv.append('textarea')
				.attr('rows', 3)
				.style('display', 'none');
			newCommentInput.attr('placeholder', "New Comment");
			this.newCommentInputNode = newCommentInput.node();
			
			$(this.newCommentInputNode).on('input', function(eventObject)
			{
				this.style.height = 0;
				this.style.height = (this.scrollHeight) + 'px';
				_this.resizeCommentsSection();
				if (this.value)
					$(_this.postButtonNode).css('display', '');
				else
					$(_this.postButtonNode).css('display', 'none');
				if (eventObject)
					eventObject.stopPropagation();
			});

			this.postButtonNode = newCommentDiv.append('button')
				.classed('post site-active-div', true)
				.text("Post")
				.style('display', 'none')
				.on('click', function()
					{
						var newComment = _this.newCommentInputNode.value;
						if (newComment)
						{
							if (prepareClick('click', 'Post Comment'))
							{
								try
								{
									showClickFeedback(this);
									_this.fd.experience.postComment({text: newComment})
										.then(function()
											{
												_this.newCommentInputNode.value = '';
												$(_this.newCommentInputNode).trigger('input');
												$(_this.newCommentInputNode).css('display', 'none');
												$(_this.postButtonNode).css('display', 'none');
												$(_this.newCommentButtonNode).css('display', '');
												_this.showLastComment();
												unblockClick();
											},
											cr.syncFail);
								}
								catch(err)
								{
									cr.syncFail(err);
								}
							}
						}
					})
				.node();

			$(this.mainDiv.node()).on('resize.cr', function()
				{
					$(_this.newCommentInputNode).width(
						$(newCommentDiv.node()).width() - 
						$(_this.postButtonNode).outerWidth(true) -
						($(newCommentInput.node()).outerWidth(true) - $(newCommentInput.node()).width()));
				});
		}
		else
			this.postButtonNode = null;
		
		if (fd.experience.id())
		{
			var fields =['comments', 'services', 'custom services'];
			if (fd.experience.privilege() == 'administer')
			{
				fields.push('user grants');
				fields.push('group grants');
			}
			this.promise = fd.experience.promiseData(fields)
				.then(function()
					{
						var r = $.Deferred();
						setTimeout(function()
							{
								/* changeEventHandler is dependent on the data, so put it here. */
								changeEventHandler();

			/* Put the call to loadComments in a setTimeout to ensure that the panel's css 
				is set up before the comments are loaded. The panel's css won't be set up 
				if the comments are already loaded.
			 */
								_this.loadComments(fd.experience.comments());
								r.resolve();
							});
						return r;
					}, cr.asyncFail);
		}
		else
		{
			this.promise = $.Deferred();
			this.promise.resolve();
			setTimeout(changeEventHandler)
		}

		$(this.mainDiv.node()).on('resize.cr', function()
			{
				_this.resizeCommentsSection();
			});
			
		$(_this.node()).on('revealing.cr', function()
			{
				if (fd.experience.canWrite())
					_this.editButton.style('display', commentList.selectAll('li').size() ? '' : 'none');
				_this.resizeCommentsSection();
			});
			
		this.promise = this.promise
			.then(function()
				{
					try
					{
						$(_this.mainDiv.node()).on('resize.cr', resizeDetail);	
			
						var f = function()
							{
								commentList.selectAll('textarea')
									.each(function()
										{
											$(this).trigger('resize.cr');
										});
							};
							
						$(_this.mainDiv.node()).on('resize.cr', f);	
						_this.setupAsk();
						f();
					}
					catch(err)
					{
						cr.asyncFail(err);
					}
				});
	}
		
	return ExperienceCommentsPanel;
})();

