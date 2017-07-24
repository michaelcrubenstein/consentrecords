var SessionPanel = (function () {
	SessionPanel.prototype = new EditPanel();
	SessionPanel.prototype.session = null;
	SessionPanel.prototype.panelTitle = "Session";
	SessionPanel.prototype.namesLabel = "Names";
	SessionPanel.prototype.nameLabel = "Name";
	SessionPanel.prototype.datePlaceholder = "(None)";
	SessionPanel.prototype.registrationDeadlineLabel = "Registration Deadline";
	SessionPanel.prototype.startLabel = "Start";
	SessionPanel.prototype.endLabel = "End";
	SessionPanel.prototype.canRegisterLabel = "Can Register";
	SessionPanel.prototype.inquiriesLabel = "Inquiries";
	SessionPanel.prototype.enrollmentsLabel = "Enrollments";
	SessionPanel.prototype.engagementsLabel = "Engagements";
	SessionPanel.prototype.periodsLabel = "Periods";
	SessionPanel.prototype.yesLabel = "Yes";
	SessionPanel.prototype.noLabel = "No";

    SessionPanel.prototype.promiseUpdateChanges = function()
    {
		var changes = {};
		var getCanRegisterValue = function(enumValue)
		{
			if (enumValue == SessionPanel.prototype.yesLabel)
				return cr.booleans.yes;
			else if (enumValue == SessionPanel.prototype.noLabel)
				return cr.booleans.no;
			else
				return "";
		}
		
		this.appendDateChanges(this.registrationDeadlineEditor, this.session.registrationDeadline(), 
								changes, 'registration deadline')
			.appendDateChanges(this.startEditor, this.session.start(),
							   changes, 'start')
			.appendDateChanges(this.endEditor, this.session.end(),
							   changes, 'end')
			.appendEnumerationChanges(this.canRegisterSection, getCanRegisterValue, 
									  this.session.canRegister(),
							   		  changes, 'can register')
			.appendTranslationChanges(this.namesSection, this.session.names, changes, 'names');
		return this.session.update(changes);
    }
    
    SessionPanel.prototype.canRegisterDescription = function()
    {
    	if (this.session.canRegister() == "yes")
    		return this.yesLabel;
    	else
    		return this.noLabel;
    }
    
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	SessionPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.registrationDeadlineEditor.wheelReveal &&
			this.registrationDeadlineEditor.wheelReveal.isVisible())
		{
			this.registrationDeadlineEditor.hideWheel(done);
			return true;
		}
		else if (newReveal != this.startEditor.wheelReveal &&
			this.startEditor.wheelReveal.isVisible())
		{
			this.startEditor.hideWheel(done);
			return true;
		}
		else if (newReveal != this.endEditor.wheelReveal &&
			this.endEditor.wheelReveal.isVisible())
		{
			this.endEditor.hideWheel(done);
			return true;
		}
		else
			return false;
	}
	
	function SessionPanel(session, onShow) {
		var _this = this;
		this.session = session;

		this.createRoot(session, this.panelTitle, "edit", onShow);

		var doneButton = this.navContainer.appendRightButton();
			
		this.navContainer.appendTitle(this.panelTitle);
		
		doneButton.on("click", function()
			{
				if (prepareClick('click', _this.panelTitle + ' done'))
				{
					showClickFeedback(this);
		
					try
					{
						/* Build up an update for initialData. */
						_this.promiseUpdateChanges()
							.then(function() { _this.hide(); },
								  cr.syncFail)
					}
					catch(err) { cr.syncFail(err); }
				}
			})
		.append("span").text(crv.buttonTexts.done);
		
		this.namesSection = this.mainDiv.append('section')
			.datum(this.session)
			.classed('cell edit multiple', true);
		this.namesSection.append('label')
			.text(this.namesLabel);
		this.appendTranslationEditor(this.namesSection, this.session, this.namesLabel, this.nameLabel, 
									 "nameAdded.cr", "nameDeleted.cr", "addName.cr nameDeleted.cr nameChanged.cr", 
									 this.session.names(),
									 cr.SessionName);

		this.registrationDeadlineSection = this.mainDiv.append('section')
			.datum(this.session)
			.classed('cell edit unique first', true);
		this.registrationDeadlineSection.append('label')
			.text(this.registrationDeadlineLabel);
		this.registrationDeadlineEditor = this.appendDateEditor(this.registrationDeadlineSection, 
							  this.datePlaceholder,
							  this.session.registrationDeadline());
				 
		this.startSection = this.mainDiv.append('section')
			.datum(this.session)
			.classed('cell edit unique', true);
		this.startSection.append('label')
			.classed('overlined', true)
			.text(this.startLabel);
		this.startEditor = this.appendDateEditor(this.startSection,
												 this.datePlaceholder,
												 this.session.start());
				 
		this.endSection = this.mainDiv.append('section')
			.datum(this.session)
			.classed('cell edit unique', true);
		this.endSection.append('label')
			.classed('overlined', true)
			.text(this.endLabel);
		this.endEditor = this.appendDateEditor(this.endSection,
												 this.datePlaceholder,
												 this.session.end());
				 
		var canRegisterSectionTextContainer = null;
		
		this.canRegisterSection = this.mainDiv.append('section')
			.classed('cell edit unique first', true)
			.datum(this.session)
			.on("click", 
				function(cell) {
					if (prepareClick('click', 'pick ' + _this.canRegisterLabel))
					{
						try
						{
							var panel = new PickUserAccessPanel();
							panel.createRoot(_this.session, canRegisterSectionTextContainer.text())
								 .showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newDescription)
								{
									canRegisterSectionTextContainer.text(newDescription);
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});
	
		this.canRegisterSection.append('label')
			.text(_this.canRegisterLabel);

		var itemsDiv = crf.appendItemList(this.canRegisterSection);

		var items = itemsDiv.append('li');

		var divs = items.append('div')
			.classed('description-text growable', true)
			.text(this.canRegisterDescription())
			.classed('unselectable', true)
			.each(_pushTextChanged);
			
		canRegisterSectionTextContainer = this.canRegisterSection.selectAll('div.description-text');
	
		crf.appendRightChevrons(items);	

		var childrenButton;
		childrenButton = this.appendActionButton(this.inquiriesLabel, function() {
				if (prepareClick('click', 'Inquiries'))
				{
					showClickFeedback(this);
					try
					{
						var panel = new InquiriesPanel(session, revealPanelLeft);
						panel.showLeft().then(unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	

		childrenButton = this.appendActionButton(this.enrollmentsLabel, function() {
				if (prepareClick('click', 'Enrollments'))
				{
					showClickFeedback(this);
					/* TODO: Edit the enrollments list */
					unblockClick();
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	

		childrenButton = this.appendActionButton(this.engagementsLabel, function() {
				if (prepareClick('click', 'Engagements'))
				{
					showClickFeedback(this);
					/* TODO: Edit the engagements list */
					unblockClick();
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	

		childrenButton = this.appendActionButton(this.periodsLabel, function() {
				if (prepareClick('click', 'Periods'))
				{
					showClickFeedback(this);
					/* TODO: Edit the periods list */
					unblockClick();
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	
	}
	
	return SessionPanel;
})();

var InquirySearchView = (function () {
	InquirySearchView.prototype = new PanelSearchView();
	InquirySearchView.prototype.session = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	InquirySearchView.prototype.onClickButton = function(d, i, button) {
		if (prepareClick('click', 'pick ' + d.constructor.name + ': ' + d.description()))
		{
			showClickFeedback(button);
			
			var panel = new InquiryPanel(this.session, d);
			panel.showLeft().then(unblockClick);
		}
		d3.event.preventDefault();
	}
	
	InquirySearchView.prototype.fields = function()
	{
		return ["parents"];
	}
	
	/* Overrides SearchView.searchPath */
	InquirySearchView.prototype.searchPath = function(val)
	{
		var s = "inquiry";
		if (val.length == 0)
			return s;
		else
		{
			if (val.length < 3)
				return s + '[user>email>text^="' + encodeURIComponent(val) + '"]';
			else
				return s + '[user>email>text*="' + encodeURIComponent(val) + '"]';
		}
	}
	
	InquirySearchView.prototype.resultType = function()
	{
		return cr.Inquiry;
	}
	
	InquirySearchView.prototype.increment = function()
	{
		return 10;
	}
	
	InquirySearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
		if (compareText.length < 3)
			return i == 0;
		else
			return i >= 0;
	}
	
	InquirySearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function InquirySearchView(sitePanel, session) {
		this.session = session;
		PanelSearchView.call(this, sitePanel, "Search", undefined, GetDataChunker);
	}
	
	return InquirySearchView;
})();

var InquiriesPanel = (function () {
	InquiriesPanel.prototype = new EditPanel();
	InquiriesPanel.prototype.session = null;
	InquiriesPanel.prototype.panelTitle = "Inquiries";

	function InquiriesPanel(session, onShow) {
		var _this = this;
		this.session = session;

		this.createRoot(session, this.panelTitle, "list", onShow);

		var backButton = this.navContainer.appendLeftButton()
			.on("click", function()
			{
				_this.hide();
			});
		appendLeftChevronSVG(backButton).classed("chevron-left", true);
		backButton.append("span").text("Back");

		var addButton = this.navContainer.appendRightButton()
				.classed('add-button', true)
				.on("click", function(d) {
					if (prepareClick('click', 'edit root objects: add'))
					{
						try
						{
							showClickFeedback(this);
							/* TODO: showAddInquiryPanel */
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.preventDefault();
				});
		addButton.append("span").text("+");
		
		this.navContainer.appendTitle(this.panelTitle);
				
		var textChanged = function(){
			var val = this.value.toLocaleLowerCase();
			if (val.length === 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style('display', null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style('display', function(d)
						{
							if (d.description().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return 'none';
						});
			}
		}

		var searchView = new InquirySearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return InquiriesPanel;
})();

