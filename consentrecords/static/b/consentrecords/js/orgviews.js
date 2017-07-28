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
									 "nameAdded.cr", "nameDeleted.cr", "addName.cr nameDeleted.cr changed.cr", 
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
			.on('click', 
				function(cell) {
					if (prepareClick('click', 'pick ' + _this.canRegisterLabel))
					{
						try
						{
							var panel = new PickCanRegisterPanel();
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
			
		var items = this.appendEnumerationEditor(this.canRegisterSection, this.canRegisterDescription());
			
		canRegisterSectionTextContainer = items.selectAll('div.description-text');
	
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
					try
					{
						var panel = new EnrollmentsPanel(session, revealPanelLeft);
						panel.showLeft().then(unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	

		childrenButton = this.appendActionButton(this.engagementsLabel, function() {
				if (prepareClick('click', 'Engagements'))
				{
					showClickFeedback(this);
					try
					{
						var panel = new EngagementsPanel(session, revealPanelLeft);
						panel.showLeft().then(unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	

		childrenButton = this.appendActionButton(this.periodsLabel, function() {
				if (prepareClick('click', 'Periods'))
				{
					showClickFeedback(this);
					try
					{
						var panel = new PeriodsPanel(session, revealPanelLeft);
						panel.showLeft().then(unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	
	}
	
	return SessionPanel;
})();

var PickCanRegisterPanel = (function () {
	PickCanRegisterPanel.prototype = new PickFromListPanel();
	PickCanRegisterPanel.prototype.title = SessionPanel.prototype.canRegisterLabel;
	PickCanRegisterPanel.prototype.buttonData = [{description: SessionPanel.prototype.yesLabel
						  },
						  {description: SessionPanel.prototype.noLabel
						  }
						 ];
	
	PickCanRegisterPanel.prototype.createRoot = function(user, path, oldDescription)
	{
		PickFromListPanel.prototype.createRoot.call(this, null, this.title, "");
		var _this = this;

		var itemsDiv = d3.select(this.node()).selectAll('section>ol');
	
		var items = itemsDiv.selectAll('li')
			.data(this.buttonData)
			.enter()
			.append('li');
		
		items.append("div")
			.classed("description-text growable unselectable", true)
			.text(function(d) { return d.description; });
				
		items.filter(function(d, i)
			{
				return d.description === oldDescription;
			})
			.insert("span", ":first-child").classed("glyphicon glyphicon-ok", true);
				
		items.on('click', function(d, i)
				{
					if (d.description === oldDescription)
						return;
					
					if (prepareClick('click', d.description))
					{
						try
						{
							$(_this.node()).trigger('itemPicked.cr', d.description);
							_this.hideRight(unblockClick);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				});
		return this;
	}
	
	function PickCanRegisterPanel() {
		PickFromListPanel.call(this);
	}
	
	return PickCanRegisterPanel;
})();

var SessionChildSearchView = (function () {
	SessionChildSearchView.prototype = new PanelSearchView();
	SessionChildSearchView.prototype.session = null;
	
	/* Overrides SearchView.searchPath */
	SessionChildSearchView.prototype.searchPath = function(val)
	{
		var s = this.pathType;
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
	
	SessionChildSearchView.prototype.increment = function()
	{
		return 10;
	}
	
	SessionChildSearchView.prototype.fields = function()
	{
		return ["parents"];
	}
	
	SessionChildSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	SessionChildSearchView.prototype.fillItems = function(items)
	{
		var deleteControls = crf.appendDeleteControls(items);
		PanelSearchView.prototype.fillItems.call(this, items);
		crf.appendConfirmDeleteControls(items);

		crf.showDeleteControls($(deleteControls[0]), 0);
		
		var _this = this;
		items.each(function(d)
			{
				setupOnViewEventHandler(d, 'deleted.cr', this, function(eventObject)
					{
						_this.getDataChunker.onItemDeleted();
						$(eventObject.data).animate({height: "0px"}, 400, 'swing', function()
						{
							$(this).remove();
						});
					});
				setupOnViewEventHandler(d, 'changed.cr', this, function(eventObject)
					{
						d3.select(eventObject.data).selectAll('div.description-text')
							.text(d.description());
					});
			});
	}
	
	SessionChildSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
		if (compareText.length < 3)
			return i == 0;
		else
			return i >= 0;
	}
	
	/* Overrides SearchView.prototype.onClickButton */
	SessionChildSearchView.prototype.onClickButton = function(d, i, button) {
		if (prepareClick('click', 'pick {0}: {1}'.format(this.pathType, d.description())))
		{
			try
			{
				showClickFeedback(button);
			
				var panel = new (this.childPanelType())(this.session, d);
				panel.showLeft().then(unblockClick);
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	SessionChildSearchView.prototype.appendSearchArea = function()
	{
		return PanelSearchView.prototype.appendSearchArea.call(this)
			.classed('deletable-items', true);
	}
	
	function SessionChildSearchView(sitePanel, session) {
		this.session = session;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return SessionChildSearchView;
})();

var SessionChildrenPanel = (function () {
	SessionChildrenPanel.prototype = new EditPanel();
	SessionChildrenPanel.prototype.session = null;
	
	SessionChildrenPanel.prototype.createRoot = function(objectData, header, onShow)
	{
		EditPanel.prototype.createRoot.call(this, objectData, header, onShow);

		var _this = this;
		var backButton = this.navContainer.appendLeftButton()
			.on('click', function()
			{
				_this.hide();
			});
		appendLeftChevronSVG(backButton).classed('chevron-left', true);
		backButton.append('span').text("Back");

		var addButton = this.navContainer.appendRightButton()
				.classed('add-button', true)
				.on('click', function(d) {
					if (prepareClick('click', 'edit root objects: add'))
					{
						try
						{
							showClickFeedback(this);
							_this.showAddPanel()
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.preventDefault();
				});
		addButton.append('span').text("+");
		
		this.navContainer.appendTitle(this.panelTitle);
	}
	
	function SessionChildrenPanel(session, onShow)
	{
		EditPanel.call(this);
		this.session = session;
	}
	
	return SessionChildrenPanel;
	
})();

var InquirySearchView = (function () {
	InquirySearchView.prototype = new SessionChildSearchView();
	InquirySearchView.prototype.pathType = "inquiry";
	
	InquirySearchView.prototype.resultType = function()
	{
		return cr.Inquiry;
	}
	
	InquirySearchView.prototype.childPanelType = function()
	{
		return InquiryPanel;
	}
	
	function InquirySearchView(sitePanel, session) {
		SessionChildSearchView.call(this, sitePanel, session);
	}
	
	return InquirySearchView;
})();

var InquiriesPanel = (function () {
	InquiriesPanel.prototype = new SessionChildrenPanel();
	InquiriesPanel.prototype.panelTitle = "Inquiries";
	InquiriesPanel.prototype.addPanelTitle = "Add Inquiry";
	
	InquiriesPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var panel = new NewInquiryPanel(this.session, this.addPanelTitle);
		setupOnViewEventHandler(this.session, 'inquiryAdded.cr', panel.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout("");
			}); 
		panel.showLeft().then(unblockClick);
	}

	function InquiriesPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, 'list', onShow);

		this.searchView = new InquirySearchView(this, session);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.search(""); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return InquiriesPanel;
})();

var EnrollmentSearchView = (function () {
	EnrollmentSearchView.prototype = new SessionChildSearchView();
	EnrollmentSearchView.prototype.pathType = "enrollment";
	
	EnrollmentSearchView.prototype.resultType = function()
	{
		return cr.Enrollment;
	}
	
	EnrollmentSearchView.prototype.childPanelType = function()
	{
		return EnrollmentPanel;
	}
	
	function EnrollmentSearchView(sitePanel, session) {
		SessionChildSearchView.call(this, sitePanel, session);
	}
	
	return EnrollmentSearchView;
})();

var EnrollmentsPanel = (function () {
	EnrollmentsPanel.prototype = new SessionChildrenPanel();
	EnrollmentsPanel.prototype.panelTitle = "Enrollments";
	EnrollmentsPanel.prototype.addPanelTitle = "Add Enrollment";

	EnrollmentsPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var panel = new NewEnrollmentPanel(this.session, this.addPanelTitle);
		setupOnViewEventHandler(this.session, 'enrollmentAdded.cr', panel.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout("");
			}); 
		panel.showLeft().then(unblockClick);
	}

	function EnrollmentsPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, 'list', onShow);

		this.searchView = new EnrollmentSearchView(this, session);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.search(""); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return EnrollmentsPanel;
})();

var EngagementSearchView = (function () {
	EngagementSearchView.prototype = new SessionChildSearchView();
	EngagementSearchView.prototype.pathType = "engagement";
	
	EngagementSearchView.prototype.resultType = function()
	{
		return cr.Engagement;
	}
	
	EngagementSearchView.prototype.childPanelType = function()
	{
		return EngagementPanel;
	}
	
	function EngagementSearchView(sitePanel, session) {
		SessionChildSearchView.call(this, sitePanel, session);
	}
	
	return EngagementSearchView;
})();

var EngagementsPanel = (function () {
	EngagementsPanel.prototype = new SessionChildrenPanel();
	EngagementsPanel.prototype.panelTitle = "Engagements";

	EngagementsPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var engagement = new cr.Engagement();
		var panel = new EngagementPanel(this.session, engagement, revealPanelUp);
		setupOnViewEventHandler(this.session, 'engagementAdded.cr', panel.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout("");
			}); 
		panel.showLeft().then(unblockClick);
	}

	function EngagementsPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, "list", onShow);

		this.searchView = new EngagementSearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				_this.searchView.search(""); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return EngagementsPanel;
})();

var PeriodSearchView = (function () {
	PeriodSearchView.prototype = new SessionChildSearchView();
	PeriodSearchView.prototype.pathType = "period";
	
	PeriodSearchView.prototype.resultType = function()
	{
		return cr.Period;
	}
	
	PeriodSearchView.prototype.childPanelType = function()
	{
		return PeriodPanel;
	}
	
	PeriodSearchView.prototype.fillItems = function(items)
	{
		SessionChildSearchView.prototype.fillItems.call(this, items);
		
		var _this = this;
		items.each(function(d)
			{
				setupOnViewEventHandler(d, 'changed.cr', this, function(eventObject)
					{
						d3.select(eventObject.data).selectAll('div.description-text')
							.text(d.description());
					});
			});
	}
	
	function PeriodSearchView(sitePanel, session) {
		SessionChildSearchView.call(this, sitePanel, session);
	}
	
	return PeriodSearchView;
})();

var PeriodsPanel = (function () {
	PeriodsPanel.prototype = new SessionChildrenPanel();
	PeriodsPanel.prototype.panelTitle = "Periods";

	PeriodsPanel.prototype.showAddPanel = function()
	{
		var period = new cr.Period();
		var panel = new PeriodPanel(this.session, period, revealPanelUp);
		panel.showLeft().then(unblockClick);
	}

	function PeriodsPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, "list", onShow);

		this.searchView = new PeriodSearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				_this.searchView.search(""); 
				_this.searchView.inputBox.focus();
			});
		setupOnViewEventHandler(this.session, 'periodAdded.cr', this.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout("");
			}); 
	}
	
	return PeriodsPanel;
})();

var EngagementPanel = (function () {
	EngagementPanel.prototype = new EditPanel();
	EngagementPanel.prototype.session = null;
	EngagementPanel.prototype.engagement = null;
	EngagementPanel.prototype.panelTitle = "Participation";
	EngagementPanel.prototype.userLabel = "Participant";
	EngagementPanel.prototype.startLabel = "Start";
	EngagementPanel.prototype.endLabel = "End";
	EngagementPanel.prototype.deleteLabel = "Delete Participant";
	EngagementPanel.prototype.startPlaceholder = "Not Sure";
	EngagementPanel.prototype.endPlaceholder = "Not Sure or Current";

    EngagementPanel.prototype.promiseUpdateChanges = function()
    {
		var changes = {};
		
		var newUser = this.userSection.datum();
		if (!newUser || !(newUser instanceof cr.User))
		{
			r2 = $.Deferred();
			r2.reject("Please specify a user.");
			return r2;
		}
		if (!this.engagement.user() || 
			this.engagement.user().id() != newUser.id())
		{
			changes['user'] = newUser.urlPath();
		}
		
		this.appendDateChanges(this.startEditor, this.engagement.start(),
							   changes, 'start')
			.appendDateChanges(this.endEditor, this.engagement.end(),
							   changes, 'end');
		if (this.engagement.id())
		{
			return this.engagement.update(changes);
		}
		else
		{
			if (Object.keys(changes).length == 0)
			{
				r2 = $.Deferred();
				r2.resolve();
				return r2;
			}
			else
			{
				changes['add'] = 1;
				changes['user'] = newUser.urlPath();
				var sessionChanges = {'engagements': [changes]};
				return this.session.update(sessionChanges);
			}
		}
    }
    
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	EngagementPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.startEditor.wheelReveal &&
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
	
	function EngagementPanel(session, engagement, onShow) {
		var _this = this;
		this.session = session;
		this.engagement = engagement;

		this.createRoot(session, this.panelTitle, "edit", onShow);
		
		this.appendBackButton();

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
		
		this.userSection = this.mainDiv.append('section')
			.datum(this.engagement.user())
			.classed('cell edit unique first', true)
			.on('click', 
				function(cell) {
					if (prepareClick('click', 'pick user'))
					{
						try
						{
							var panel = new PickEngagementUserPanel(_this.session, engagement, "Pick User");
							panel.showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newUser)
								{
									_this.userSection.datum(newUser);
									_this.userSection.selectAll('li>div').text(newUser.description());
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});

		this.userSection.append('label')
			.text(this.userLabel);
		var user = this.engagement.user();
		var items = this.appendEnumerationEditor(this.userSection, 
			user ? this.engagement.user().description() : "(None)");
		this.userSection.datum(user);
		crf.appendRightChevrons(items);	
				 
		this.startSection = this.mainDiv.append('section')
			.datum(this.session)
			.classed('cell edit unique', true);
		this.startSection.append('label')
			.classed('overlined', true)
			.text(this.startLabel);
		this.startEditor = this.appendDateEditor(this.startSection,
												 this.startPlaceholder,
												 this.engagement.start());
				 
		this.endSection = this.mainDiv.append('section')
			.datum(this.session)
			.classed('cell edit unique', true);
		this.endSection.append('label')
			.classed('overlined', true)
			.text(this.endLabel);
		this.endEditor = this.appendDateEditor(this.endSection,
												 this.endPlaceholder,
												 this.engagement.end());
		
		if (this.engagement.id())	
		{	 
			childrenButton = this.appendActionButton(this.deleteLabel, function() {
				if (prepareClick('click', this.deleteLabel))
				{
					showClickFeedback(this);
					try
					{
						new ConfirmDeleteAlert(_this.node(), _this.deleteLabel, 
							function() { 
								_this.engagement.deleteData()
									.then(function() { _this.hide() },
										  cr.syncFail);
							}, 
							unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
			childrenButton.selectAll('li>div')
				.classed('site-active-text', false)
				.classed('text-danger', true);
		}
	}
	
	return EngagementPanel;
})();

var PeriodPanel = (function () {
	PeriodPanel.prototype = new EditPanel();
	PeriodPanel.prototype.session = null;
	PeriodPanel.prototype.period = null;
	PeriodPanel.prototype.panelTitle = "Participation";
	PeriodPanel.prototype.weekdayLabel = "Weekday";
	PeriodPanel.prototype.startTimeLabel = "Start Time";
	PeriodPanel.prototype.endTimeLabel = "End Time";
	PeriodPanel.prototype.deleteLabel = "Delete Period";
	PeriodPanel.prototype.weekdayDescriptions = {
			'0': "Sunday",
			'1': "Monday",
			'2': "Tuesday",
			'3': "Wednesday",
			'4': "Thursday",
			'5': "Friday",
			'6': "Saturday",
		};

    PeriodPanel.prototype.promiseUpdateChanges = function()
    {
		var changes = {};
		
		var _this = this;
		
		var getWeekdayValue = function(enumValue)
		{
			if (enumValue == null)
				return null;
			else
				return Date.CultureInfo.dayNames.indexOf(enumValue);
		}

		this.appendEnumerationChanges(this.weekdaySection, getWeekdayValue, 
									  this.period.weekday(), changes, 'weekday')
			.appendTimeChanges(this.startTimeSection, this.period.startTime(),
							   changes, 'start time')
			.appendTimeChanges(this.endTimeSection, this.period.endTime(),
							   changes, 'end time');
		
		if (!('weekday' in changes) && !this.period.weekday())
		{
			r2 = $.Deferred();
			r2.reject("Please specify a weekday.");
			return r2;
		}

		if (this.period.id())
		{
			return this.period.update(changes);
		}
		else
		{
			if (Object.keys(changes).length == 0)
			{
				r2 = $.Deferred();
				r2.resolve();
				return r2;
			}
			else
			{
				changes['add'] = 1;
				var sessionChanges = {'periods': [changes]};
				return this.session.update(sessionChanges);
			}
		}
    }
    
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	PeriodPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		return false;
	}
	
	function PeriodPanel(session, period, onShow) {
		var _this = this;
		this.session = session;
		this.period = period;

		this.createRoot(session, this.panelTitle, "edit", onShow);
		
		this.appendBackButton();

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
		
		this.weekdaySection = this.mainDiv.append('section')
			.datum(this.period)
			.classed('cell edit unique first', true)
			.on('click', 
				function(cell) {
					if (prepareClick('click', 'pick weekday'))
					{
						try
						{
							var panel = new PickWeekdayPanel(weekdayTextContainer.text(), "Pick Weekday");
							panel.showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newDescription)
								{
									weekdayTextContainer.text(newDescription);
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});
			
		function getWeekdayDescription(weekday)
		{
			if (weekday == null)
				return "";
			var i = parseInt(weekday);
			if (i >= 0 && i <= 6)
				return Date.CultureInfo.dayNames[i];
			else
				return "";
		}

		this.weekdaySection.append('label')
			.text(this.weekdayLabel);
		var items = this.appendEnumerationEditor(this.weekdaySection, getWeekdayDescription(period.weekday()));
		weekdayTextContainer = items.selectAll('div.description-text');
		crf.appendRightChevrons(items);	
				 
		this.startTimeSection = this.mainDiv.append('section')
			.datum(this.period)
			.classed('cell edit unique first', true);
		this.startTimeSection.append('label')
			.text(this.startTimeLabel);
		this.appendTextEditor(this.startTimeSection,
												 this.startTimeLabel,
												 this.period.startTime(),
												 'time');
				 
		this.endTimeSection = this.mainDiv.append('section')
			.datum(this.period)
			.classed('cell edit unique first', true);
		this.endTimeSection.append('label')
			.text(this.endTimeLabel);
		this.appendTextEditor(this.endTimeSection,
												 this.endTimeLabel,
												 this.period.endTime(),
												 'time');
		
		if (this.period.id())	
		{	 
			childrenButton = this.appendActionButton(this.deleteLabel, function() {
				if (prepareClick('click', this.deleteLabel))
				{
					showClickFeedback(this);
					try
					{
						new ConfirmDeleteAlert(_this.node(), _this.deleteLabel, 
							function() { 
								_this.period.deleteData()
									.then(function() { _this.hide() },
										  cr.syncFail);
							}, 
							unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
			childrenButton.selectAll('li>div')
				.classed('site-active-text', false)
				.classed('text-danger', true);
		}
	}
	
	return PeriodPanel;
})();

var PickUserSearchView = (function () {
	PickUserSearchView.prototype = new PanelSearchView();
	PickUserSearchView.prototype.session = null;
	
	/* Overrides SearchView.searchPath */
	PickUserSearchView.prototype.searchPath = function(val)
	{
		var s = "user";
		if (val.length == 0)
			return "";
		else
		{
			return s + '[email>text^="' + encodeURIComponent(val) + '"]';
		}
	}
	
	PickUserSearchView.prototype.increment = function()
	{
		return 20;
	}
	
	PickUserSearchView.prototype.fields = function()
	{
		return [];
	}
	
	PickUserSearchView.prototype.resultType = function()
	{
		return cr.User;
	}
	
	PickUserSearchView.prototype.fillItems = function(items)
	{
		PanelSearchView.prototype.fillItems.call(this, items);
		appendInfoButtons(items);
	}
	
	PickUserSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
		return i == 0;
	}
	
	function PickUserSearchView(sitePanel, session) {
		this.session = session;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return PickUserSearchView;
})();

var NewInquirySearchView = (function()
{
	NewInquirySearchView.prototype = new PickUserSearchView();
	
	/* Overrides SearchView.prototype.onClickButton */
	NewInquirySearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				cr.getData({path: this.session.urlPath() + "/inquiry[user={0}]".format(user.id()),
							resultType: cr.Inquiry,
							})
				  .then(function(inquiries)
						{
							try
							{
								var offering = _this.session.offering();
								if (inquiries.length)
									cr.syncFail("{0} already inquired into {1}/{2}"
										.format(user.description(), offering.description(), _this.session.description()));
								else
								{
									changes = {'inquiries':
										[{'add': '1', 'user': user.urlPath()}]};
									_this.session.update(changes)
										.then(function()
											{
												bootstrap_alert.success(
													"{0} inquiry added to {1}/{2}"
														.format(user.description(), offering.description(), _this.session.description()),
													".alert-container");
												unblockClick();
											},
											cr.syncFail);
								}
							}
							catch(err) { cr.syncFail(err); }
						});
				
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function NewInquirySearchView(sitePanel, session)
	{
		PickUserSearchView.call(this, sitePanel, session);
	}
	
	return NewInquirySearchView;
})();

var NewInquiryPanel = (function()
{
	NewInquiryPanel.prototype = new SitePanel();
	NewInquiryPanel.prototype.session = null;
	function NewInquiryPanel(session, title)
	{
		SitePanel.call(this);
		this.createRoot(session, title, 'list');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		var centerButton = navContainer.appendTitle(title);

		this.searchView = new NewInquirySearchView(this, session);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return NewInquiryPanel;
})();

var NewEnrollmentSearchView = (function()
{
	NewEnrollmentSearchView.prototype = new PickUserSearchView();
	
	/* Overrides SearchView.prototype.onClickButton */
	NewEnrollmentSearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				cr.getData({path: this.session.urlPath() + "/enrollment[user={0}]".format(user.id()),
							resultType: cr.Enrollment,
							})
				  .then(function(enrollments)
						{
							try
							{
								var offering = _this.session.offering();
								if (enrollments.length)
									cr.syncFail("{0} already enrolled in {1}/{2}"
										.format(user.description(), offering.description(), _this.session.description()));
								else
								{
									changes = {'enrollments':
										[{'add': '1', 'user': user.urlPath()}]};
									_this.session.update(changes)
										.then(function()
											{
												bootstrap_alert.success(
													"{0} enrolled in {1}/{2}"
														.format(user.description(), offering.description(), _this.session.description()),
													".alert-container");
												_this.sitePanel.hide();
											},
											cr.syncFail);
								}
							}
							catch(err) { cr.syncFail(err); }
						});
				
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function NewEnrollmentSearchView(sitePanel, session)
	{
		PickUserSearchView.call(this, sitePanel, session);
	}
	
	return NewEnrollmentSearchView;
})();

var NewEnrollmentPanel = (function()
{
	NewEnrollmentPanel.prototype = new SitePanel();
	NewEnrollmentPanel.prototype.session = null;
	function NewEnrollmentPanel(session, title)
	{
		SitePanel.call(this);
		this.createRoot(session, title, 'list');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		var centerButton = navContainer.appendTitle(title);

		this.searchView = new NewEnrollmentSearchView(this, session);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return NewEnrollmentPanel;
})();

var PickEngagementUserSearchView = (function()
{
	PickEngagementUserSearchView.prototype = new PickUserSearchView();
	PickEngagementUserSearchView.prototype.engagement = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	PickEngagementUserSearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				cr.getData({path: this.session.urlPath() + "/engagement[user={0}]".format(user.id()),
							resultType: cr.Engagement,
							})
				  .then(function(engagements)
						{
							try
							{
								var offering = _this.session.offering();
								if (engagements.length && engagements[0].id() != _this.engagement.id())
									cr.syncFail("{0} already engaged in {1}/{2}"
										.format(user.description(), offering.description(), _this.session.description()));
								else
								{
									$(_this.sitePanel.node()).trigger('itemPicked.cr', user);
									_this.sitePanel.hide();
								}
							}
							catch(err) { cr.syncFail(err); }
						});
				
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function PickEngagementUserSearchView(sitePanel, session, engagement)
	{
		PickUserSearchView.call(this, sitePanel, session);
		this.engagement = engagement;
	}
	
	return PickEngagementUserSearchView;
})();

var PickEngagementUserPanel = (function()
{
	PickEngagementUserPanel.prototype = new SitePanel();
	PickEngagementUserPanel.prototype.session = null;

	function PickEngagementUserPanel(session, engagement, title)
	{
		SitePanel.call(this);
		this.createRoot(session, title, 'list');

		this.navContainer = this.appendNavContainer();

		var _this = this;
		this.appendBackButton();

		var centerButton = this.navContainer.appendTitle(title);

		this.searchView = new PickEngagementUserSearchView(this, session, engagement);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return PickEngagementUserPanel;
})();

var PickWeekdayPanel = (function () {
	PickWeekdayPanel.prototype = new PickFromListPanel();
	PickWeekdayPanel.prototype.title = PeriodPanel.prototype.weekdayLabel;
	PickWeekdayPanel.prototype.buttonData = ["0", "1", "2", "3", "4", "5", "6"];
	
	PickWeekdayPanel.prototype.createRoot = function(oldDescription)
	{
		PickFromListPanel.prototype.createRoot.call(this, null, this.title, "");
		var _this = this;

		var itemsDiv = d3.select(this.node()).selectAll('section>ol');
	
		var getDescription = function(d)
		{
			return PeriodPanel.prototype.weekdayDescriptions[d];
		}
		
		var items = itemsDiv.selectAll('li')
			.data(this.buttonData)
			.enter()
			.append('li');
		
		items.append("div")
			.classed("description-text growable unselectable", true)
			.text(function(d) { return getDescription(d); });
				
		items.filter(function(d, i)
			{
				return getDescription(d) === oldDescription;
			})
			.insert("span", ":first-child").classed("glyphicon glyphicon-ok", true);
				
		items.on('click', function(d, i)
				{
					if (getDescription(d) === oldDescription)
						return;
					
					if (prepareClick('click', getDescription(d)))
					{
						try
						{
							$(_this.node()).trigger('itemPicked.cr', getDescription(d));
							_this.hideRight(unblockClick);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				});
		return this;
	}
	
	function PickWeekdayPanel(oldDescription) {
		PickFromListPanel.call(this);
		this.createRoot(oldDescription);
	}
	
	return PickWeekdayPanel;
})();

