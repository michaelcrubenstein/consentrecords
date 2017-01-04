/* experienceCommentsPanel.js */

var ExperienceCommentsPanel = (function() {
	ExperienceCommentsPanel.prototype = new SitePanel();
	ExperienceCommentsPanel.prototype.fd = null;
	ExperienceCommentsPanel.prototype.inEditMode = false;
	
	ExperienceCommentsPanel.prototype.appendDescriptions = function(buttons)
	{
		var divs = buttons.append('div');
		
		var askers = divs.append('div')
			.classed('asker', true)
			.datum(function(d) { 
				var cp = d.getValue("Comment Request"); 
				return cp && cp.getInstanceID() && cp.getValue("Path"); })
			.text(function(d) { 
					return d && d.getInstanceID() && "{0} asked".format(d.getDescription()); 
				});

		var questions = divs.append('textarea')
			.classed('question', true)
			.datum(function(d) { 
				var cp = d.getValue("Comment Request");
				return cp && cp.getInstanceID() && cp.getValue("_text"); })
			.text(function(d) { 
					return d && d.text; 
				});
				
		var answers = divs.append('textarea')
			.classed('answer', true)
			.datum(function(d) { return d.getValue("_text"); })
			.text(function(d) { 
					return (d && d.text); 
				})
			.attr('placeholder', 'No Answer');
				
		var checkSize = function(eventObject) {
			this.style.height = 0;
			this.style.height = (this.scrollHeight) + 'px';
			this.style.display = (this.value || this.getAttribute('placeholder')) ? 'inline-block' : 'none';
			eventObject.stopPropagation();
		}
			
		buttons.selectAll('textarea.question')
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
				
		buttons.selectAll('textarea.answer')
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
	
	ExperienceCommentsPanel.prototype.loadComments = function(data)
	{
		var commentList = this.mainDiv.select('section.comments>ol');
		var items = appendItems(commentList, data);
		
		appendConfirmDeleteControls(items);
		var buttons = items.append('div');

		var deleteControls = this.appendDeleteControls(buttons);

		this.appendDescriptions(buttons);
		if (!this.inEditMode)
			this.hideDeleteControlsNow($(deleteControls[0]));
		else
			this.showDeleteControls($(deleteControls[0]), 0);
	}
	
	ExperienceCommentsPanel.prototype.postComment = function(newText, done, fail)
	{
		var comments = this.fd.experience.getValue("Comments");
		var initialData = {_text: [{text: newText}]};
		
		if (comments.getInstanceID())
		{
			/* Test case: add a comment to an experience that has had a comment */
			var commentCell = comments.getCell("Comment");
			$.when(cr.createInstance(commentCell.field, comments.getInstanceID(), initialData))
		     .then(function(newValue)
					{
						newValue.promiseCellsFromCache()
							.then( 
							function() {
								commentCell.addValue(newValue);
								done(newValue);
							},
							fail);
					},
					fail);
		}
		else
		{
			/* Test case: add a comment to an experience that has not had a comment previously added. */
			$.when(comments.saveNew({Comment: [{cells: initialData}]}))
			 .then(done, fail);
		}
	}
	
	ExperienceCommentsPanel.prototype.askQuestion = function(newText)
	{
		
		/* Test case: add a comment to an experience that has had a comment */
		return cr.requestExperienceComment(this.fd.experience, cr.signedinUser.getValue("Path"), newText);
	}
	
	ExperienceCommentsPanel.prototype.checkTextAreas = function(done, fail)
	{
		var commentsDiv = this.mainDiv.select('section.comments');
		var cell = commentsDiv.datum();
		var initialData = [];
		var sourceObjects = [];
		
		commentsDiv.selectAll('li textarea').each(function(d)
			{
				var newValue = this.value.trim();
				if (d)
					d.appendUpdateCommands(0, newValue, initialData, sourceObjects);
			});
		if (initialData.length > 0)
		{
			cr.updateValues(initialData, sourceObjects)
				.then(function() {
					if (done)
						done();
				}, 
				fail);
		}
		else
			done();
	}
	
	ExperienceCommentsPanel.prototype.startEditing = function()
	{
		if (prepareClick('click', 'Start Editing'))
		{
			try
			{
				var _this = this;
				var commentList = this.mainDiv.select('section.comments>ol');
				showClickFeedback(this.editButton.node(), function()
					{
						_this.editButton.selectAll('span').text("Done");
					});
				this.showDeleteControls();
				this.inEditMode = true;
				commentList.selectAll('textarea')
					.attr('readonly', null)
					.classed('fixed', false)
					.classed('editable', true);
				unblockClick();
			}
			catch(err)
			{
				this.editButton.selectAll('span').text("Edit");
				cr.syncFail(err);
			}
		}
	}
	
	ExperienceCommentsPanel.prototype.focusOnComment = function(id)
	{
		var commentList = this.mainDiv.select('section.comments>ol');
		var textAreas = $(commentList.node()).children('li')
			.filter(function() {
					return d3.select(this).datum().id == id;
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

	function ExperienceCommentsPanel(fd)
	{
		this.createRoot(fd, "Comments", "comments", revealPanelLeft);
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
						_this.checkTextAreas(function()
							{
								_this.hide();
							},
							cr.syncFail);
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

		this.inEditMode = false;
		if (fd.experience.canWrite())
		{		
			this.editButton = navContainer.appendRightButton()
				.on("click", function()
				{
					if (_this.inEditMode)
					{
						if (prepareClick('click', 'Done Editing'))
						{
							/* Store the new text in a button so that it is set properly
								when an error occurs whether or not the callback to showClickFeedback is called. */
							var newButtonText = "Edit";
							var fail = function(err)
								{
									newButtonText = "Done";
									_this.editButton.selectAll('span').text(newButtonText);
									cr.syncFail(err);
								}
							try
							{
								showClickFeedback(this, function()
									{
										_this.editButton.selectAll('span').text(newButtonText);
									});
								_this.checkTextAreas(function()
									{
										_this.hideDeleteControls();
										_this.inEditMode = false;
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
						_this.startEditing();
					}
				});
			this.editButton.append('span').text("Edit");
		}

		navContainer.appendTitle('Comments');
		
		var panel2Div = this.appendScrollArea();

		this.svg = panel2Div.append('svg')
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1");
		this.detailGroup = this.svg.append('g')
			.classed('detail', true)
			.datum(fd);
		this.detailFrontRect = this.detailGroup.append('rect')
			.classed('detail', true);
		fd.colorElement(this.detailFrontRect.node());
		
		var detailText = _this.detailGroup.append('text');

		function resizeDetail()
		{
			fd.appendTSpans(detailText, parseFloat(_this.svg.style('width')), 12);
			var textBox = detailText.node().getBBox();
			_this.detailRectHeight = textBox.height + (textBox.y * 2) + PathView.prototype.textBottomMargin;
			_this.detailFrontRect.attr('height', _this.detailRectHeight)
				.attr('width', _this.svg.style('width'));
			_this.svg.attr('height', _this.detailRectHeight);
		}
		setTimeout(resizeDetail);
		
		var comments = fd.experience.getValue("Comments");
		var commentsDiv = panel2Div.append('section')
			.classed('multiple comments', true);
		var commentList = commentsDiv.append('ol');
		
		function onCommentAdded(eventObject, newData)
		{
			eventObject.data.loadComments([newData]);
		}
		
		function onCommentsChecked(commentsCells)
		{
			var commentCell = commentsCells.find(function(cell)
				{
					return cell.field.name == "Comment";
				});
			$(commentCell).on('valueAdded.cr', null, _this, onCommentAdded);
			$(commentsDiv.node()).on('remove', null, commentCell, function(commentCellEventObject)
				{
					$(commentCellEventObject.data).off('valueAdded.cr', null, onCommentAdded);
				});
			_this.loadComments(commentCell.data);
		}
		
		function onNewCommentsSaved(eventObject, changeTarget)
		{
			if (changeTarget.getTypeName() == "Comments")
				changeTarget.promiseCellsFromCache(["Comment"])
					.then(onCommentsChecked, cr.asyncFail)
		}
		
		$(comments).on('dataChanged.cr', null, this, onNewCommentsSaved);
		$(commentsDiv.node()).on('remove', null, comments.cell, function(eventObject)
			{
				$(eventObject.data).off('dataChanged.cr', null, onNewCommentsSaved);
			});
		
		if (fd.experience.canWrite())
		{
			var newCommentDiv = panel2Div.append('section')
				.classed('new-comment', true);
			var newCommentInput = newCommentDiv.append('textarea')
				.attr('rows', 3);
			newCommentInput.attr('placeholder', 'New Comment');

			var postButton = newCommentDiv.append('button')
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
									_this.postComment(newComment, function()
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
					});
			
			var newQuestionDiv = panel2Div.append('section')
				.classed('new-comment', true);
			var newQuestionInput = newQuestionDiv.append('textarea')
				.attr('rows', 3);
			newQuestionInput.attr('placeholder', 'New Question');

			var askButton = newQuestionDiv.append('button')
				.classed('post site-active-div', true)
				.text('Ask')
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
									_this.askQuestion(newQuestion)
										.then(function()
											{
												newQuestionInput.node().value = '';
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
			
			var resizeFunction = function()
			{
				$(newCommentInput.node()).width(
					$(newCommentDiv.node()).width() - 
					$(postButton.node()).outerWidth(true) -
					($(newCommentInput.node()).outerWidth(true) - $(newCommentInput.node()).width()));
				$(newQuestionInput.node()).width(
					$(newQuestionDiv.node()).width() - 
					$(postButton.node()).outerWidth(true) -
					($(newQuestionInput.node()).outerWidth(true) - $(newQuestionInput.node()).width()));
			}
			$(panel2Div.node()).on('resize.cr', resizeFunction);
		}
							
		$(panel2Div.node()).on('resize.cr', resizeDetail);	
						
		$(panel2Div.node()).on('resize.cr', function()
			{
				commentList.selectAll('textarea')
					.each(function()
						{
							$(this).trigger('resize.cr');
						});
			});					
		
		if (comments.getInstanceID())
		{
			/* Put this in a setTimeout to ensure that the panel's css is set up before the 
				comments are loaded. This won't happen if the comments are already loaded.
			 */
			this.promise = comments.promiseCellsFromCache(["Comment/Comment Request"])
				.then(function(comments)
					{
						var r = $.Deferred();
						setTimeout(function()
							{
								onCommentsChecked(comments);
								r.resolve();
							});
						return r;
					}, cr.asyncFail);
		}
		else
		{
			var commentsAdded = function(eventObject, newValue)
				{
					/* Have to promiseCells here in case the comments have just been added
						due to a post operation. */
					newValue.promiseCellsFromCache(["Comment/Comment Request"])
						.then(function()
							{
								onCommentsChecked(newValue.getCells());
							},
							cr.asyncFail);
				}
			$(fd.experience.getCell('Comments')).one('valueAdded.cr', null, this, commentsAdded);
			$(panel2Div.node()).on('remove', function()
				{
					$(fd.experience.getCell('Comments')).off('valueAdded.cr', null, commentsAdded);
				});
			this.promise = $.Deferred();
			this.promise.resolve();
		}
	}
		
	return ExperienceCommentsPanel;
})();

var AddCommentOptions = (function () {
	AddCommentOptions.prototype.dimmer = null;
	AddCommentOptions.prototype.panelNode = null;
	AddCommentOptions.prototype.cancelButtonNode = null;

	AddCommentOptions.prototype.handleCancel = function(done, fail)
	{
		$(this.cancelButtonNode).off('blur');
		$(this.panelNode).hide("slide", {direction: "down"}, 400, function() {
			d3.select(this.panelNode).remove();
			if (done) done();
		});
	}
	
	AddCommentOptions.prototype.onCancel = function(e)
	{
		try
		{
			this.handleCancel(undefined);
			this.dimmer.hide();
		}
		catch(err)
		{
			cr.asyncFail(err);
		}
		e.preventDefault();
	}
	
	AddCommentOptions.prototype.addButton = function(div, name, clickFunction)
	{
		var _this = this;
		var button = div.append('button')
			.text(name)
			.classed('site-active-text', true)
			.on('click', function()
				{
					if (prepareClick('click', name))
					{
						_this.dimmer.hide();
						clickFunction(unblockClick, cr.syncFail);
					}
				});
		return button;
	}
	
	AddCommentOptions.prototype.addCommandButtons = function(div)
	{
		var _this = this;

		this.addButton(div, "Add Comment", 
			function(done, fail)
			{
				$(_this.panelNode).hide("slide", {direction: "down"}, 400, function() {
					d3.select(_this.panelNode).remove();
				});
			})
			.classed('butted-down', true);
		
		this.addButton(div, "Ask Question", 
			function(done, fail)
			{
				$(_this.panelNode).hide("slide", {direction: "down"}, 400, function() {
					d3.select(_this.panelNode).remove();
				});
			});
		
		this.addButton(div, 'More Ideas',
			function(done, fail)
			{
				$(_this.panelNode).hide("slide", {direction: "down"}, 400, function() {
					d3.select(_this.panelNode).remove();
				});
			});
		
	}

	function AddCommentOptions(pathlinesPanel)
	{
		var panelNode = pathlinesPanel.node();
		this.dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		this.panelNode = panel.node();
		var div = panel.append('div');
		var _this = this;
		
		this.addCommandButtons(div);
				
		var cancelButton = this.addButton(div, 'Cancel', function(done, fail)
			{
				_this.handleCancel(done, fail);
			});
		this.cancelButtonNode = cancelButton.node();
		$(this.cancelButtonNode).on('blur', function(e)
			{
				_this.onCancel(e);
			});
		
		this.dimmer.show();
		$(this.panelNode).toggle("slide", {direction: "down", duration: 0});
		$(this.panelNode).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(_this.cancelButtonNode).focus();
				unblockClick();
			}});
		this.dimmer.mousedown(function(e)
			{
				_this.onCancel(e);
			});
		$(this.panelNode).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return AddCommentOptions;
})();

