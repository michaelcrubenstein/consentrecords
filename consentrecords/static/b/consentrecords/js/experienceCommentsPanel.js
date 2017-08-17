/* experienceCommentsPanel.js */

var ExperienceCommentsPanel = (function() {
	ExperienceCommentsPanel.prototype = new SitePanel();
	ExperienceCommentsPanel.prototype.fd = null;
	ExperienceCommentsPanel.prototype.inEditMode = false;
	ExperienceCommentsPanel.prototype.detailGroup = null;
	ExperienceCommentsPanel.prototype.detailTextGroup = null;
	ExperienceCommentsPanel.prototype.detailFrontRect = null;
	ExperienceCommentsPanel.prototype.detailRectHeight = 0;
	ExperienceCommentsPanel.prototype.svg = null;
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
				})
			.attr('placeholder', 'No Answer');
				
		var checkSize = function(eventObject) {
			this.style.height = 0;
			this.style.height = (this.scrollHeight) + 'px';
			this.style.display = (this.value || this.getAttribute('placeholder')) ? 'inline-block' : 'none';
			eventObject.stopPropagation();
		}
			
		divs.selectAll('textarea.question')
			.attr('readonly', this.inEditMode ? null : 'readonly')
			.classed('editable', this.inEditMode)
			.classed('fixed', !this.inEditMode)
			.each(function()
				{
					this.setAttribute('style', 'height:0px;overflow-y:hidden;display:inline-block;');
					this.setAttribute('style', 'height:' + (this.scrollHeight) + 'px;overflow-y:hidden;display:inline-block;');
					this.style.display = this.value ? 'inline-block' : 'none';
					$(this).on('input', checkSize);
					$(this).on('resize.cr', checkSize);
				});
				
		divs.selectAll('textarea.answer')
			.attr('readonly', this.inEditMode ? null : 'readonly')
			.classed('editable', this.inEditMode)
			.classed('fixed', !this.inEditMode)
			.each(function()
				{
					this.setAttribute('style', 'height:0px;overflow-y:hidden;display:inline-block;');
					this.setAttribute('style', 'height:' + (this.scrollHeight) + 'px;overflow-y:hidden;display:inline-block;');
					this.style.display = 'inline-block';
					$(this).on('input', checkSize);
					$(this).on('resize.cr', checkSize);
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
		var commentList = this.mainDiv.select('section.comments>ol');
		var items = appendItems(commentList, data);
		
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
		
		this.checkDeleteControlVisibility(items);
	}
	
	ExperienceCommentsPanel.prototype.askQuestion = function(newText)
	{
		/* Test case: add a comment to an experience that has had a comment */
		return this.fd.experience.postComment({asker: cr.signedinUser.path().urlPath(),
											   question: newText});
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
					_this.editButton.selectAll('span').text(crv.buttonTexts.done);
				});
			crf.showDeleteControls(dials);
			this.inEditMode = true;
			commentList.classed('edit', true);
			commentList.selectAll('textarea')
				.attr('readonly', null)
				.classed('fixed', false)
				.classed('editable', true);
			
			/* position the edit chevron as appropriate. 
				12 + 12 is the left edge (12 for the width of the chevron and 12 for the right margin)
				18 is the height of the chevron, so that the chevron is vertically centered. 
			 */
			if (_this.detailRectHeight > 0)
			{
				this.editChevronContainer.transition()
					.duration(400)
					.attr("transform", 
						"translate({0},{1})".format(
							$(_this.svg.node()).width() - (_this.editChevronWidth + 12), 
							(_this.detailRectHeight - _this.editChevronHeight) / 2));
			}
					
			this.detailTextGroup.selectAll('line')
				.transition()
				.duration(400)
				.attr('x2', $(_this.svg.node()).width() - (_this.editChevronWidth + 12) - 12);
		}
		catch(err)
		{
			this.editButton.selectAll('span').text(crv.buttonTexts.edit);
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
	
	ExperienceCommentsPanel.prototype.setupAsk = function()
	{
		var _this = this;
		var canBeAsked = this.fd.experience.path().canAnswerExperience();
		if (cr.signedinUser.id() && canBeAsked != "no")
		{
			var newQuestionDiv = this.mainDiv.append('section')
				.classed('new-comment', true);
			var newQuestionInput = newQuestionDiv.append('textarea')
				.attr('rows', 3);
			newQuestionInput.attr('placeholder', "New Question");

			var askButton = newQuestionDiv.append('button')
				.classed('post site-active-div', true)
				.text("Ask")
				.on('click', function()
					{
						var newQuestion = newQuestionInput.node().value;
						if (newQuestion)
						{
							if (prepareClick('click', 'Ask Question'))
							{
								try
								{
									showClickFeedback(this);
									bootstrap_alert.success("Sending email (this may take a few minutes)...", this.alertSuccess);
									_this.askQuestion(newQuestion)
										.then(function()
											{
												newQuestionInput.node().value = '';
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
					});
			
			var commentPromptsDiv = this.mainDiv.append('section')
				.classed('comment-prompts', true);
			
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
								newQuestionInput.node().value = '';
								newQuestionInput.node().value = d.description();
								newQuestionInput.node().focus();
								var textWidth = newQuestionInput.node().value.length;
								newQuestionInput.node().setSelectionRange(textWidth, textWidth)
							});
					resizeQuestionBoxes();
				}, cr.asyncFail)		
							
			$(this.mainDiv.node()).on('resize.cr', resizeQuestionBoxes);
		}
	}
	
	function ExperienceCommentsPanel(fd)
	{
		this.createRoot(fd, "Experience", "comments", revealPanelLeft);
		this.fd = fd;
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.classed('chevron-left-container', true)
			.on("click", function()
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
		appendLeftChevronSVG(backButton).classed("chevron-left", true);
		backButton.append("span").text("Back");

		var shareButton = navContainer.appendRightButton()
			.classed("share", true)
			.on('click', function()
				{
					if (prepareClick('click', 'share'))
					{
						new ExperienceShareOptions(_this.node(), fd.experience, fd.experience.path());
					}
				});
		shareButton.append("img")
			.attr("src", shareImagePath);

		this.inEditMode = false;
		if (fd.experience.canWrite())
		{		
			this.editButton = navContainer.appendRightButton()
				.on("click", function()
				{
					if (_this.inEditMode)
					{
						if (prepareClick('click', 'Done Edit Experience Comments'))
						{
							/* Store the new text in a button so that it is set properly
								when an error occurs whether or not the callback to showClickFeedback is called. */
							var newButtonText = crv.buttonTexts.edit;
							var fail = function(err)
								{
									newButtonText = crv.buttonTexts.done;
									_this.editButton.selectAll('span').text(newButtonText);
									cr.syncFail(err);
								}
							try
							{
								showClickFeedback(this, function()
									{
										_this.editButton.selectAll('span').text(newButtonText);
									});
								_this.checkTextAreas()
									.then(function()
									{
										_this.editChevronContainer.transition()
											.duration(400)
											.attr("transform", 
												"translate({0},{1})".format(
													$(_this.svg.node()).width(), 
													($(_this.svg.node()).height() - _this.editChevronHeight) / 2));
													
										_this.detailTextGroup.selectAll('line')
											.transition()
											.duration(400)
											.attr('x2', $(_this.svg.node()).width());

										var dials = $(_this.node()).find('ol.deletable-items>li>button:first-of-type');
										crf.hideDeleteControls(dials);
										_this.inEditMode = false;
										commentList.classed('edit', false);
										commentList.selectAll('textarea')
											.attr('readonly', 'readonly')
											.classed('editable', false)
											.classed('fixed', true);

										unblockClick();
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
				.classed('edit', true)
				.append('span').text(crv.buttonTexts.edit);
		}

		navContainer.appendTitle("Experience");
		
		var panel2Div = this.appendScrollArea();

		this.svg = panel2Div.append('svg')
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1");
		this.detailGroup = this.svg.append('g')
			.classed('detail', true)
			.datum(fd);
		this.detailTextGroup = this.detailGroup.append('g');
		this.detailFrontRect = this.detailGroup.append('rect')
			.classed('detail', true);
		fd.colorElement(this.detailFrontRect.node());
		
		function resizeDetail()
		{
			fd.appendTSpans(_this.detailTextGroup, parseFloat(_this.svg.style('width')), 12);
			var textBox = _this.detailTextGroup.node().getBBox();
			_this.detailRectHeight = textBox.height + (textBox.y) + PathView.prototype.textBottomMargin;
			_this.detailFrontRect.attr('height', _this.detailRectHeight)
				.attr('width', _this.svg.style('width'));
			_this.svg.attr('height', _this.detailRectHeight);
			
			if (fd.experience.canWrite())
			{
				_this.editChevronContainer.attr("transform", 
					"translate({0},{1})".format(
						$(_this.svg.node()).width() - (_this.inEditMode ? _this.editChevronWidth + 12 : 0), 
						(_this.detailRectHeight - _this.editChevronHeight) / 2));
				
				var lineWidth = $(_this.svg.node()).width() - (_this.inEditMode ? _this.editChevronWidth + 24 : 0);	
				_this.detailTextGroup.selectAll('line')
					.attr('x2', lineWidth);
			}
		}
		setTimeout(resizeDetail);
		
		/* Update the contents of the top banner if the contents of the experience are changed. */
		fd.setupChangeEventHandler(this.mainDiv.node(), function(eventObject, newValue)
			{
				fd.colorElement(_this.detailFrontRect.node());
				resizeDetail();
			});
		
		/* Hide this panel if the experience is deleted */
		setupOneViewEventHandler(fd.experience, "deleted.cr", this.node(), function(eventObject)
			{
				_this.hideNow();
			});

		if (fd.experience.canWrite())
		{
			this.editChevronContainer = this.detailGroup.append('g');
		
			this.editChevronContainer.append('g')
				.classed('chevron-right', true)
				.attr('transform', 'scale(0.0625)')
				.append('polygon')
				.attr('points', "0,32.4 32.3,0 192,160 192,160 192,160 32.3,320 0,287.6 127.3,160");
			this.editChevronContainer.attr("transform", 
					"translate({0},{1})".format(
						$(_this.svg.node()).width(), 
						$(_this.svg.node()).height() / 2));
						
			this.svg.on('click', function(e)
				{
					if (_this.inEditMode)
					{
						_this.showDetailPanel(fd);
					}
				})
		}
		
		var comments = fd.experience.comments();
		var commentsDiv = panel2Div.append('section')
			.classed('multiple comments', true);
		var commentList = crf.appendItemList(commentsDiv)
			.classed('deletable-items', true);
		commentList.classed('edit', this.inEditMode);
		
		setupOnViewEventHandler(fd.experience, 'commentAdded.cr', commentsDiv.node(), 
			function (eventObject, newData)
				{
					_this.loadComments([newData]);
				});
		
		function onCommentsChecked(experience)
		{
			_this.loadComments(experience.comments());
		}
		
		setupOnViewEventHandler(fd.experience, 'changed.cr', commentsDiv.node(), 
			function (eventObject, changeTarget)
			{
				if (changeTarget instanceof cr.Experience)
					changeTarget.promiseComments()
						.then(function()
							{
								onCommentsChecked(changeTarget);
							}, cr.asyncFail)
			});
		
		if (fd.experience.canWrite())
		{
			var newCommentDiv = panel2Div.append('section')
				.classed('new-comment', true);
			var newCommentInput = newCommentDiv.append('textarea')
				.attr('rows', 3);
			newCommentInput.attr('placeholder', 'New Comment');

			this.postButtonNode = newCommentDiv.append('button')
				.classed('post site-active-div', true)
				.text('Post')
				.on('click', function()
					{
						var newComment = newCommentInput.node().value;
						if (newComment)
						{
							if (prepareClick('click', 'Post Comment'))
							{
								try
								{
									showClickFeedback(this);
									_this.fd.experience.postComment({text: newText})
										.then(function()
											{
												newCommentInput.node().value = '';
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

			$(panel2Div.node()).on('resize.cr', function()
				{
					$(newCommentInput.node()).width(
						$(newCommentDiv.node()).width() - 
						$(_this.postButtonNode).outerWidth(true) -
						($(newCommentInput.node()).outerWidth(true) - $(newCommentInput.node()).width()));
				});
		}
		else
			this.postButtonNode = null;
		
		$(panel2Div.node()).on('resize.cr', resizeDetail);	
						
		$(panel2Div.node()).on('resize.cr', function()
			{
				commentList.selectAll('textarea')
					.each(function()
						{
							$(this).trigger('resize.cr');
						});
			});					
		
		if (fd.experience.id())
		{
			/* Put this in a setTimeout to ensure that the panel's css is set up before the 
				comments are loaded. This won't happen if the comments are already loaded.
			 */
			this.promise = fd.experience.promiseComments()
				.then(function(comments)
					{
						var r = $.Deferred();
						setTimeout(function()
							{
								onCommentsChecked(fd.experience);
								r.resolve();
							});
						return r;
					}, cr.asyncFail);
		}
		else
		{
			this.promise = $.Deferred();
			this.promise.resolve();
		}
		
		this.promise = this.promise
			.then(function()
				{
					_this.setupAsk();
				});
	}
		
	return ExperienceCommentsPanel;
})();

