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

/* When the user picks an access that includes a special access for the path, 
	the _special access value is set. Otherwise, it is cleared. Currently, there is 
	no check for whether there are access records on the path because there is no such
	functionality.
 */ 
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
		PickFromListPanel.prototype.createRoot(null, this.title, "");
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
				d.on("deleted.cr", this, function(eventObject)
					{
						_this.getDataChunker.onItemDeleted();
						removeItem(eventObject.data);
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

	function InquiriesPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, "list", onShow);

		var searchView = new InquirySearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
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

	function EnrollmentsPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, "list", onShow);

		var searchView = new EnrollmentSearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
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

	function EngagementsPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, "list", onShow);

		var searchView = new EngagementSearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
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
	
	function PeriodSearchView(sitePanel, session) {
		SessionChildSearchView.call(this, sitePanel, session);
	}
	
	return PeriodSearchView;
})();

var PeriodsPanel = (function () {
	PeriodsPanel.prototype = new SessionChildrenPanel();
	PeriodsPanel.prototype.panelTitle = "Periods";

	function PeriodsPanel(session, onShow) {
		SessionChildrenPanel.call(this, session, onShow);
		var _this = this;

		this.createRoot(session, this.panelTitle, "list", onShow);

		var searchView = new PeriodSearchView(this, session);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
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
				changes['user'] = this.engagement.user().urlPath();
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
			.datum(this.session)
			.classed('cell edit unique first', true);
		this.userSection.append('label')
			.text(this.userLabel);
		var items = this.appendEnumerationEditor(this.userSection, this.engagement.user().description());
				 
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
		return 10;
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
	
	/* Overrides SearchView.prototype.onClickButton */
	PickUserSearchView.prototype.onClickButton = function(user, i, button) {
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
									cr.syncFail(user.description() + 
									  " already inquired into " + 
									  offering.description() + "/" + _this.session.description());
								else
								{
									changes = {'inquiries':
										[{'add': '1', 'user': user.urlPath()}]};
									_this.session.update(changes)
										.then(function()
											{
												bootstrap_alert.success(user.description() + 
													  " inquiry added to " + 
													  offering.description() + "/" + _this.session.description(),
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
	
	function PickUserSearchView(sitePanel, session) {
		this.session = session;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return PickUserSearchView;
})();

var AddInquiryPanel = (function()
{
	AddInquiryPanel.prototype = new SitePanel();
	AddInquiryPanel.prototype.session = null;
	function AddInquiryPanel(session, title)
	{
		SitePanel.call(this);
		this.createRoot(session, title, 'list');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		var centerButton = navContainer.appendTitle(title);

		var searchView = new PickUserSearchView(this, session);
		$(this.node()).one('revealing.cr', function() { 
				searchView.textCleared(); 
				searchView.inputBox.focus();
			});
	}
	
	return AddInquiryPanel;
})();