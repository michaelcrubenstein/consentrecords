var ChildPanel = (function () {
	ChildPanel.prototype = Object.create(EditItemPanel.prototype);
	ChildPanel.prototype.constructor = ChildPanel;

	ChildPanel.prototype.appendDeleteButton = function()
	{
		var _this = this;
		if (this.controller().oldInstance())	
		{	 
			childrenButton = this.appendActionButton(this.deleteLabel, function() {
				if (prepareClick('click', this.deleteLabel))
				{
					showClickFeedback(this);
					try
					{
						new ConfirmDeleteAlert(_this.node(), _this.deleteLabel, 
							function() { 
								_this.controller().oldInstance().deleteData()
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
	
	function ChildPanel(controller)
	{
		EditItemPanel.call(this, controller);
	}
	
	return ChildPanel;
})();

var ChildSearchView = (function () {
	ChildSearchView.prototype = Object.create(PanelSearchView.prototype);
	ChildSearchView.prototype.constructor = ChildSearchView;
	
	ChildSearchView.prototype.pathType = null;
	ChildSearchView.prototype.textPath = null;
	ChildSearchView.prototype.parent = null;
	
	/* Overrides SearchView.searchPath */
	ChildSearchView.prototype.searchPath = function(val)
	{
		console.assert(this.pathType);	/* Make sure it is defined. */
		console.assert(this.textPath);	/* Make sure it is defined. */
		
		var s = this.parent.urlPath() + '/' + this.pathType;
		if (val.length == 0)
			return s;
		else
		{
			if (val.length < 3)
				return s + '[' + this.textPath + '^="' + encodeURIComponent(val) + '"]';
			else
				return s + '[' + this.textPath + '*="' + encodeURIComponent(val) + '"]';
		}
	}
	
	ChildSearchView.prototype.increment = function()
	{
		return 10;
	}
	
	ChildSearchView.prototype.fields = function()
	{
		return ["parents"];
	}
	
	ChildSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	ChildSearchView.prototype.fillItems = function(items)
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
	
	ChildSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		/* If parent hasn't been saved, then all items are visible. */
		if (!this.parent.id())
			return true;
			
		if (compareText.length === 0)
			return true;
			
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
		if (compareText.length < 3)
			return i == 0;
		else
			return i >= 0;
	}
	
	/* Overrides SearchView.prototype.onClickButton */
	ChildSearchView.prototype.onClickButton = function(d, i, button) {
		var _this = this;
		
		if (prepareClick('click', 'pick {0}: {1}'.format(this.pathType, d.description())))
		{
			try
			{
				showClickFeedback(button);
				d.promiseData()
					.then(function()
						{
							try
							{
								var controller = new (_this.controllerType())(_this.parent, d, true);
								controller.oldInstance(d);
								var panel = new (_this.childPanelType())(controller, revealPanelLeft);
								panel.showLeft().then(unblockClick);
							}
							catch(err) { cr.syncFail(err); }
						},
						cr.syncFail);
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	ChildSearchView.prototype.appendSearchArea = function()
	{
		return PanelSearchView.prototype.appendSearchArea.call(this)
			.classed('deletable-items', true);
	}
	
	function ChildSearchView(sitePanel, parent, placeholder) {
		placeholder = placeholder !== undefined ? placeholder : crv.buttonTexts.search;
		
		this.parent = parent;
		PanelSearchView.call(this, sitePanel, placeholder, GetDataChunker);
	}
	
	return ChildSearchView;
})();

var ChildrenPanel = (function () {
	ChildrenPanel.prototype = Object.create(EditPanel.prototype);
	ChildrenPanel.prototype.constructor = ChildrenPanel;

	ChildrenPanel.prototype.parent = null;
	
	ChildrenPanel.prototype.createRoot = function(objectData, header, onShow)
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

		this.navContainer.appendTitle(header);

		var addButton = this.navContainer.appendRightButton()
				.classed('add-button', true)
				.on('click', function(d) {
					if (prepareClick('click', 'edit root objects: add'))
					{
						try
						{
							showClickFeedback(this);
							_this.showAddPanel();
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.preventDefault();
				});
		addButton.append('span').text("+");
		
		this.searchView = new (this.searchViewType)(this, this.parent);
		$(this.node()).one('revealing.cr', function() {
				if (_this.parent.id())
				{
					_this.searchView.search("");
					if (_this.searchView.inputBox) 
						_this.searchView.inputBox.focus();
				}
				else 
				{
					_this.searchView.showObjects(_this.savedItems());
					if (_this.searchView.inputBox) 
						_this.searchView.inputBox.setAttribute('disabled', true);
				}
			});
	}
	
	ChildrenPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var controller = new (this.searchView.controllerType())(this.parent);
		var panel = new (this.searchView.childPanelType())(controller, revealPanelUp);
		setupOnViewEventHandler(this.parent, controller.addEventType, panel.node(), function(eventObject, newInstance)
			{
				if (_this.parent.id())
					_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
				else
				{
					_this.searchView.showObjects([newInstance]);
				}
			}); 
		
		panel.showUp().then(unblockClick);
	}

	function ChildrenPanel(parent, onShow)
	{
		EditPanel.call(this);
		this.parent = parent;
	}
	
	return ChildrenPanel;
	
})();

var PickStatePanel = (function () {
	PickStatePanel.prototype = Object.create(PickFromListPanel.prototype);
	PickStatePanel.prototype.constructor = PickStatePanel;

	PickStatePanel.prototype.title = crv.buttonTexts.state;
	
	PickStatePanel.prototype.data = function()
	{
		return [{code: '', name: crv.buttonTexts.nullString},
				{code: 'AL', name: 'Alabama'},
				{code: 'AK', name: 'Alaska'},
				{code: 'AZ', name: 'Arizona'},
				{code: 'AR', name: 'Arkansas'},
				{code: 'CA', name: 'California'},
				{code: 'CO', name: 'Colorado'},
				{code: 'CT', name: 'Connecticut'},
				{code: 'DE', name: 'Delaware'},
				{code: 'DC', name: 'District of Columbia'},
				{code: 'FL', name: 'Florida'},
				{code: 'GA', name: 'Georgia'},
				{code: 'HI', name: 'Hawaii'},
				{code: 'IA', name: 'Iowa'},
				{code: 'ID', name: 'Idaho'},
				{code: 'IL', name: 'Illinois'},
				{code: 'IN', name: 'Indiana'},
				{code: 'KS', name: 'Kansas'},
				{code: 'KY', name: 'Kentucky'},
				{code: 'LA', name: 'Louisiana'},
				{code: 'ME', name: 'Maine'},
				{code: 'MD', name: 'Maryland'},
				{code: 'MA', name: 'Massachusetts'},
				{code: 'MI', name: 'Michigan'},
				{code: 'MN', name: 'Minnesota'},
				{code: 'MS', name: 'Mississippi'},
				{code: 'MO', name: 'Missouri'},
				{code: 'MT', name: 'Montana'},
				{code: 'NC', name: 'North Carolina'},
				{code: 'ND', name: 'North Dakota'},
				{code: 'NH', name: 'New Hampshire'},
				{code: 'NJ', name: 'New Jersey'},
				{code: 'NM', name: 'New Mexico'},
				{code: 'NE', name: 'Nebraska'},
				{code: 'NV', name: 'Nevada'},
				{code: 'NY', name: 'New York'},
				{code: 'OH', name: 'Ohio'},
				{code: 'OK', name: 'Oklahoma'},
				{code: 'OR', name: 'Oregon'},
				{code: 'PA', name: 'Pennsylvania'},
				{code: 'RH', name: 'Rhode Island'},
				{code: 'SC', name: 'South Carolina'},
				{code: 'SD', name: 'South Dakota'},
				{code: 'TN', name: 'Tennessee'},
				{code: 'TX', name: 'Texas'},
				{code: 'UT', name: 'Utah'},
				{code: 'VT', name: 'Vermont'},
				{code: 'VA', name: 'Virginia'},
				{code: 'WA', name: 'Washington'},
				{code: 'WV', name: 'West Virginia'},
				{code: 'WI', name: 'Wisconsin'},
				{code: 'WY', name: 'Wyoming'},
			   ];
	}
	
	PickStatePanel.prototype.isInitialValue = function(d)
	{
		return d.code === this.initialValue;
	}

	PickStatePanel.prototype.pickedValue = function(d)
	{
		return d.code;
	}

	PickStatePanel.prototype.datumDescription = function(d)
	{
		return d.name;
	}
	
	PickStatePanel.prototype.getDescription = function(storedValue)
	{
		return storedValue || crv.buttonTexts.nullString;
	}

	PickStatePanel.prototype.createRoot = function(user, initialValue)
	{
		this.initialValue = initialValue;
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, initialValue);
	}
	
	function PickStatePanel() {
		PickFromListPanel.call(this);
	}
	
	return PickStatePanel;
})();

var AddressPanel = (function () {
	AddressPanel.prototype = Object.create(ChildPanel.prototype);
	AddressPanel.prototype.constructor = AddressPanel;

	AddressPanel.prototype.panelTitle = "Address";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	AddressPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
			return false;
	}
	
	function AddressPanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.address, onShow);
		
		/* Fill in the controls for editing */
		this.namesSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit multiple', true);
		this.namesSection.append('label')
			.text(crv.buttonTexts.streets);
		this.appendOrderedTextEditor(this.namesSection, controller.newInstance(), crv.buttonTexts.streets, crv.buttonTexts.street, 
									 controller.newInstance().streets(),
									 cr.Street);

		this.citySection = this.appendTextSection(controller.newInstance(), controller.newInstance().city, crv.buttonTexts.city, 'text');
		this.citySection.classed('first', true);
				 
		this.stateSection = this.appendEnumerationPickerSection(controller.newInstance(), controller.newInstance().state, crv.buttonTexts.state, PickStatePanel)
		this.zipCodeSection = this.appendTextSection(controller.newInstance(), controller.newInstance().zipCode, crv.buttonTexts.zipCode, 'text');
	}
	
	return AddressPanel;
})();

var PickCanRegisterPanel = (function () {
	PickCanRegisterPanel.prototype = Object.create(PickFromListPanel.prototype);
	PickCanRegisterPanel.prototype.constructor = PickCanRegisterPanel;

	PickCanRegisterPanel.prototype.title = crv.buttonTexts.canRegister;
	
	PickCanRegisterPanel.prototype.data = function()
	{
		return [{code: '', name: crv.buttonTexts.nonePlaceholder},
				{code: 'yes', name: crv.buttonTexts.yes},
				{code: 'no', name: crv.buttonTexts.no},
			   ];
	}
	
	PickCanRegisterPanel.prototype.isInitialValue = function(d)
	{
		return d.code === this.initialValue;
	}

	PickCanRegisterPanel.prototype.pickedValue = function(d)
	{
		return d.code;
	}

	PickCanRegisterPanel.prototype.datumDescription = function(d)
	{
		return d.name;
	}
	
	PickCanRegisterPanel.prototype.createRoot = function(user, initialValue)
	{
		this.initialValue = initialValue;
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, initialValue);
	}
	
	function PickCanRegisterPanel() {
		PickFromListPanel.call(this);
	}
	
	PickCanRegisterPanel.prototype.getDescription = function(storedValue)
	{
		var d = PickCanRegisterPanel.prototype.data.call(null).find(function(d)
			{
				return d.code == storedValue;
			})
		return d && d.name;
	}

	return PickCanRegisterPanel;
})();

var EnrollmentSearchView = (function () {
	EnrollmentSearchView.prototype = Object.create(ChildSearchView.prototype);
	EnrollmentSearchView.prototype.constructor = EnrollmentSearchView;

	EnrollmentSearchView.prototype.textPath = 'user>email>text';
	EnrollmentSearchView.prototype.pathType = 'enrollment';
	
	EnrollmentSearchView.prototype.resultType = function()
	{
		return cr.Enrollment;
	}
	
	EnrollmentSearchView.prototype.controllerType = function()
	{
		return EnrollmentController;
	}
	
	EnrollmentSearchView.prototype.childPanelType = function()
	{
		return EnrollmentPanel;
	}
	
	EnrollmentSearchView.prototype.onClickButton = function(enrollment, i, button) {
		if (prepareClick('click', 'enrollment: ' + enrollment.description()))
		{
			try
			{
				showClickFeedback(button);
				showUser(enrollment.user());
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	EnrollmentSearchView.prototype.fillItems = function(items)
	{
		ChildSearchView.prototype.fillItems.call(this, items);
		appendInfoButtons(items, function(d)
			{
				return d.user();
			}, 
			function(items) { return items.insert('div', 'button:last-of-type'); });
	}
	
	function EnrollmentSearchView(sitePanel, parent) {
		ChildSearchView.call(this, sitePanel, parent);
	}
	
	return EnrollmentSearchView;
})();

var EnrollmentsPanel = (function () {
	EnrollmentsPanel.prototype = Object.create(ChildrenPanel.prototype);
	EnrollmentsPanel.prototype.constructor = EnrollmentsPanel;

	EnrollmentsPanel.prototype.addPanelTitle = "Add Enrollment";
	EnrollmentsPanel.prototype.searchViewType = EnrollmentSearchView;
	
	EnrollmentsPanel.prototype.savedItems = function()
	{
		return this.parent.enrollments();
	}
	
	EnrollmentsPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var panel = new NewEnrollmentPanel(this.parent, this.addPanelTitle);
		setupOnViewEventHandler(this.parent, 'enrollmentAdded.cr', panel.node(), function(eventObject, newInstance)
			{
				if (_this.parent.id())
					_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
				else
				{
					_this.searchView.showObjects([newInstance]);
				}
			}); 
		panel.showUp().then(unblockClick);
	}
	
	function EnrollmentsPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.enrollments, 'list', onShow);
	}
	
	return EnrollmentsPanel;
})();

var EngagementSearchView = (function () {
	EngagementSearchView.prototype = Object.create(ChildSearchView.prototype);
	EngagementSearchView.prototype.constructor = EngagementSearchView;

	EngagementSearchView.prototype.textPath = 'user>email>text';
	EngagementSearchView.prototype.pathType = 'engagement';
	
	EngagementSearchView.prototype.resultType = function()
	{
		return cr.Engagement;
	}
	
	EngagementSearchView.prototype.controllerType = function()
	{
		return EngagementController;
	}
	
	EngagementSearchView.prototype.childPanelType = function()
	{
		return EngagementPanel;
	}
	
	EngagementSearchView.prototype.fillItems = function(items)
	{
		ChildSearchView.prototype.fillItems.call(this, items);
		appendInfoButtons(items, function(d)
			{
				return d.user();
			}, 
			function(items) { return items.insert('div', 'button:last-of-type'); });
	}
	
	function EngagementSearchView(sitePanel, parent) {
		ChildSearchView.call(this, sitePanel, parent);
	}
	
	return EngagementSearchView;
})();

var EngagementsPanel = (function () {
	EngagementsPanel.prototype = Object.create(ChildrenPanel.prototype);
	EngagementsPanel.prototype.constructor = EngagementsPanel;

	EngagementsPanel.prototype.addPanelTitle = "Add Engagement";
	EngagementsPanel.prototype.searchViewType = EngagementSearchView;
	
	EngagementsPanel.prototype.savedItems = function()
	{
		return this.parent.engagements();
	}
	
	function EngagementsPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.engagements, 'list', onShow);
	}
	
	return EngagementsPanel;
})();

var PickWeekdayPanel = (function () {
	PickWeekdayPanel.prototype = Object.create(PickFromListPanel.prototype);
	PickWeekdayPanel.prototype.constructor = PickWeekdayPanel;

	PickWeekdayPanel.prototype.title = crv.buttonTexts.weekday;
	
	PickWeekdayPanel.prototype.data = function()
	{
		return [{code: '', name: crv.buttonTexts.nonePlaceholder},
				{code: '0', name: "Sunday"},
				{code: '1', name: "Monday"},
				{code: '2', name: "Tuesday"},
				{code: '3', name: "Wednesday"},
				{code: '4', name: "Thursday"},
				{code: '5', name: "Friday"},
				{code: '6', name: "Saturday"},
			   ];
	}
	
	PickWeekdayPanel.prototype.isInitialValue = function(d)
	{
		return d.code === this.initialValue.toString();
	}

	PickWeekdayPanel.prototype.pickedValue = function(d)
	{
		return d.code;
	}

	PickWeekdayPanel.prototype.datumDescription = function(d)
	{
		return d.name;
	}
	
	PickWeekdayPanel.prototype.createRoot = function(user, initialValue)
	{
		this.initialValue = initialValue;
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, initialValue);
	}
	
	function PickWeekdayPanel() {
		PickFromListPanel.call(this);
	}
	
	PickWeekdayPanel.prototype.getDescription = function(storedValue)
	{
		var d = PickWeekdayPanel.prototype.data.call(null).find(function(d)
			{
				return d.code == storedValue;
			})
		return d && d.name;
	}

	return PickWeekdayPanel;
})();

var PeriodPanel = (function () {
	PeriodPanel.prototype = Object.create(ChildPanel.prototype);
	PeriodPanel.prototype.constructor = PeriodPanel;

	PeriodPanel.prototype.deleteLabel = "Delete Period";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	PeriodPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		return false;
	}
	
	function PeriodPanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.period, onShow);
		
		/* Fill in the controls for editing */
		this.weekdaySection = this.appendEnumerationPickerSection(controller.newInstance(), controller.newInstance().weekday, crv.buttonTexts.weekday, PickWeekdayPanel)
		this.weekdaySection.classed('first', true);
				 
		this.startTimeSection = this.appendTextSection(controller.newInstance(), cr.Period.prototype.startTime, crv.buttonTexts.startTime, 'time');
		this.startTimeSection.classed('first', true);
		this.endTimeSection = this.appendTextSection(controller.newInstance(), cr.Period.prototype.endTime, crv.buttonTexts.endTime, 'time');

		/* Add a delete button. */
		this.appendDeleteButton();
	}
	
	return PeriodPanel;
})();

var PeriodSearchView = (function () {
	PeriodSearchView.prototype = Object.create(ChildSearchView.prototype);
	PeriodSearchView.prototype.constructor = PeriodSearchView;

	PeriodSearchView.prototype.textPath = 'weekday';
	PeriodSearchView.prototype.pathType = 'period';
	
	PeriodSearchView.prototype.resultType = function()
	{
		return cr.Period;
	}
	
	PeriodSearchView.prototype.controllerType = function()
	{
		return PeriodController;
	}
	
	PeriodSearchView.prototype.childPanelType = function()
	{
		return PeriodPanel;
	}
	
	function PeriodSearchView(sitePanel, parent) {
		ChildSearchView.call(this, sitePanel, parent, null);
	}
	
	return PeriodSearchView;
})();

var PeriodsPanel = (function () {
	PeriodsPanel.prototype = Object.create(ChildrenPanel.prototype);
	PeriodsPanel.prototype.constructor = PeriodsPanel;

	PeriodsPanel.prototype.addPanelTitle = "Add Period";
	PeriodsPanel.prototype.searchViewType = PeriodSearchView;
	
	PeriodsPanel.prototype.savedItems = function()
	{
		return this.parent.periods();
	}
	

	function PeriodsPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.periods, "list", onShow);
	}
	
	return PeriodsPanel;
})();

var EngagementPanel = (function () {
	EngagementPanel.prototype = Object.create(ChildPanel.prototype);
	EngagementPanel.prototype.constructor = EngagementPanel;

	EngagementPanel.prototype.deleteLabel = "Delete Engagement";

	EngagementPanel.prototype.promiseUpdateChanges = function()
	{
		if (this.controller().newInstance().user() == null)
			throw new Error("The user of an engagement is required.");
		return ChildPanel.prototype.promiseUpdateChanges.call(this);
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
	
	function EngagementPanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.engagement, onShow);
		
		/* Fill in the controls for editing */
		this.userSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit unique first', true)
			.on('click', 
				function(cell) {
					if (prepareClick('click', 'pick user'))
					{
						try
						{
							var panel = new PickEngagementUserPanel(controller.newInstance().parent(), controller.newInstance(), "Pick User");
							panel.showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newUser)
								{
									controller.newInstance().user(newUser);
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
			.text(crv.buttonTexts.user);
		var user = controller.newInstance().user();
		var items = this.appendEnumerationEditor(this.userSection, 
			user ? controller.newInstance().user().description() : crv.buttonTexts.nullString);
		this.userSection.datum(user);
		crf.appendRightChevrons(items);	
				 
		this.startSection = this.appendDateSection(controller.newInstance(), controller.newInstance().start, crv.buttonTexts.start);
		this.startEditor = this.startSection.editor;
		this.endSection = this.appendDateSection(controller.newInstance(), controller.newInstance().end, crv.buttonTexts.end);
		this.endEditor = this.endSection.editor;

		/* Add a delete button. */
		this.appendDeleteButton();
	}
	
	return EngagementPanel;
})();

var PickUserSearchView = (function () {
	PickUserSearchView.prototype = Object.create(PanelSearchView.prototype);
	PickUserSearchView.prototype.constructor = PickUserSearchView;

	PickUserSearchView.prototype.parent = null;
	
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
	
	function PickUserSearchView(sitePanel, parent) {
		this.parent = parent;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return PickUserSearchView;
})();

var NewInquirySearchView = (function()
{
	NewInquirySearchView.prototype = Object.create(PickUserSearchView.prototype);
	NewInquirySearchView.prototype.constructor = NewInquirySearchView;

	
	/* Overrides SearchView.prototype.onClickButton */
	NewInquirySearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				
				var f = function()
					{
						var offering = _this.parent.parent();
						console.assert(offering);
						bootstrap_alert.success(
							"{0} inquiry added to {1}/{2}"
								.format(user.description(), offering.description(), _this.parent.description()));
						unblockClick();
					}
				if (this.parent.id())
				{
					cr.getData({path: this.parent.urlPath() + "/inquiry[user={0}]".format(user.id()),
								resultType: cr.Inquiry,
								})
						.then(function(inquiries)
							{
								if (inquiries.length)
								{
									var offering = _this.parent.parent();
									console.assert(offering);
									cr.syncFail(new Error("{0} already inquired into {1}/{2}"
										.format(user.description(), offering.description(), _this.parent.description())));
								}
								else
								{
									changes = {'inquiries':
										[{'add': '1', 'user': user.urlPath()}]};
									_this.parent.update(changes)
										.then(f, cr.syncFail);
								}
							},
							cr.syncFail);
				}
				else
				{
					var newInstance = new cr.Inquiry();
					newInstance.clientID(uuid.v4());
					newInstance.user(user);
					newInstance.calculateDescription();
					changes = {'inquiries':
						[{'add': newInstance.clientID(), 'user': user.urlPath()}]};
					_this.parent.inquiries().push(newInstance);
					_this.parent.updateData(changes, {});
					f();
				}
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function NewInquirySearchView(sitePanel, parent)
	{
		PickUserSearchView.call(this, sitePanel, parent);
	}
	
	return NewInquirySearchView;
})();

var NewInquiryPanel = (function()
{
	NewInquiryPanel.prototype = Object.create(crv.SitePanel.prototype);
	NewInquiryPanel.prototype.constructor = NewInquiryPanel;

	NewInquiryPanel.prototype.parent = null;
	function NewInquiryPanel(parent, title)
	{
		crv.SitePanel.call(this);
		this.createRoot(parent, title, 'list');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		navContainer.appendTitle(title);

		this.searchView = new NewInquirySearchView(this, parent);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return NewInquiryPanel;
})();

var NewEnrollmentSearchView = (function()
{
	NewEnrollmentSearchView.prototype = Object.create(PickUserSearchView.prototype);
	NewEnrollmentSearchView.prototype.constructor = NewEnrollmentSearchView;

	/* Overrides SearchView.prototype.onClickButton */
	NewEnrollmentSearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				var f = function()
					{
						var offering = _this.parent.parent();
						console.assert(offering);
						bootstrap_alert.success(
							"{0} enrolled in {1}/{2}"
								.format(user.description(), offering.description(), _this.parent.description()));
						unblockClick();
					}
				if (this.parent.id())
				{
					cr.getData({path: this.parent.urlPath() + "/enrollment[user={0}]".format(user.id()),
								resultType: cr.Enrollment,
								})
					  .then(function(enrollments)
							{
								try
								{
									var offering = _this.parent.parent();
									console.assert(offering);
									if (enrollments.length)
										cr.syncFail("{0} already enrolled in {1}/{2}"
											.format(user.description(), offering.description(), _this.parent.description()));
									else
									{
										changes = {'enrollments':
											[{'add': '1', 'user': user.urlPath()}]};
										_this.parent.update(changes)
											.then(f, cr.syncFail);
									}
								}
								catch(err) { cr.syncFail(err); }
							},
							cr.syncFail);
					}
					else
					{
						var newInstance = new cr.Enrollment();
						newInstance.clientID(uuid.v4());
						newInstance.user(user);
						newInstance.calculateDescription();
						changes = {'enrollments':
							[{'add': newInstance.clientID(), 'user': user.urlPath()}]};
						_this.parent.enrollments().push(newInstance);
						_this.parent.updateData(changes, {});
						f();
					}
				
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function NewEnrollmentSearchView(sitePanel, parent)
	{
		PickUserSearchView.call(this, sitePanel, parent);
	}
	
	return NewEnrollmentSearchView;
})();

var NewEnrollmentPanel = (function()
{
	NewEnrollmentPanel.prototype = Object.create(crv.SitePanel.prototype);
	NewEnrollmentPanel.prototype.constructor = NewEnrollmentPanel;

	NewEnrollmentPanel.prototype.parent = null;
	function NewEnrollmentPanel(parent, title)
	{
		crv.SitePanel.call(this);
		this.createRoot(parent, title, 'list');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		navContainer.appendTitle(title);

		this.searchView = new NewEnrollmentSearchView(this, parent);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return NewEnrollmentPanel;
})();

var PickEngagementUserSearchView = (function()
{
	PickEngagementUserSearchView.prototype = Object.create(PickUserSearchView.prototype);
	PickEngagementUserSearchView.prototype.constructor = PickEngagementUserSearchView;

	PickEngagementUserSearchView.prototype.engagement = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	PickEngagementUserSearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				if (this.parent.id())
				{
					cr.getData({path: this.parent.urlPath() + "/engagement[user={0}]".format(user.id()),
								resultType: cr.Engagement,
								})
					  .then(function(engagements)
							{
								try
								{
									var offering = _this.parent.offering();
									if (engagements.length && engagements[0].id() != _this.engagement.id())
										cr.syncFail("{0} already engaged in {1}/{2}"
											.format(user.description(), offering.description(), _this.parent.description()));
									else
									{
										$(_this.sitePanel.node()).trigger('itemPicked.cr', user);
										_this.sitePanel.hide();
									}
								}
								catch(err) { cr.syncFail(err); }
							});
				}
				else
				{
					$(_this.sitePanel.node()).trigger('itemPicked.cr', user);
					_this.sitePanel.hide();
				}
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function PickEngagementUserSearchView(sitePanel, parent, engagement)
	{
		PickUserSearchView.call(this, sitePanel, parent);
		this.engagement = engagement;
	}
	
	return PickEngagementUserSearchView;
})();

var PickEngagementUserPanel = (function()
{
	PickEngagementUserPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickEngagementUserPanel.prototype.constructor = PickEngagementUserPanel;

	PickEngagementUserPanel.prototype.parent = null;

	function PickEngagementUserPanel(parent, engagement, title)
	{
		crv.SitePanel.call(this);
		this.createRoot(parent, title, 'list');

		this.navContainer = this.appendNavContainer();

		var _this = this;
		this.appendBackButton();

		this.navContainer.appendTitle(title);

		this.searchView = new PickEngagementUserSearchView(this, parent, engagement);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return PickEngagementUserPanel;
})();

var RootPanelSearchView = (function () {
	RootPanelSearchView.prototype = Object.create(PanelSearchView.prototype);
	RootPanelSearchView.prototype.constructor = RootPanelSearchView;

	RootPanelSearchView.prototype.searchPathTextField = 'name>text';
	
	/* Overrides SearchView.searchPath */
	RootPanelSearchView.prototype.searchPath = function(val)
	{
		var s = this.searchPathType;
		if (val.length == 0)
			return s;
		else
		{
			if (val.length < 3)
				return s + '[{0}^="{1}"]'.format(this.searchPathTextField, encodeURIComponent(val));
			else
				return s + '[{0}*="{1}"]'.format(this.searchPathTextField, encodeURIComponent(val));
		}
	}
	
	RootPanelSearchView.prototype.increment = function()
	{
		return 50;
	}
	
	RootPanelSearchView.prototype.fields = function()
	{
		return ['names'];
	}
	
	RootPanelSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	RootPanelSearchView.prototype.fillItems = function(items)
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
	
	RootPanelSearchView.prototype.isButtonVisible = function(button, d, compareText)
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
	RootPanelSearchView.prototype.onClickButton = function(d, i, button) {
		var _this = this;
		if (prepareClick('click', 'pick {0}: {1}'.format(this.resultType().name, d.description())))
		{
			d.promiseData()
				.then(function()
					{
						try
						{
							showClickFeedback(button);
			
							var controller = new (_this.controllerType())(d);
							controller.oldInstance(d);
							var panel = new (_this.childPanelType())(controller);
							panel.showLeft().then(unblockClick);
						}
						catch (err) { cr.syncFail(err); }
					},
					cr.syncFail);
		}
		d3.event.preventDefault();
	}
	
	RootPanelSearchView.prototype.appendSearchArea = function()
	{
		return PanelSearchView.prototype.appendSearchArea.call(this)
			.classed('deletable-items', true);
	}
	
	function RootPanelSearchView(sitePanel) {
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return RootPanelSearchView;
})();

var RootItemsPanel = (function () {
	RootItemsPanel.prototype = Object.create(EditPanel.prototype);
	RootItemsPanel.prototype.constructor = RootItemsPanel;

	RootItemsPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var controller = new (this.searchView.controllerType())(null);
		var panel = new (this.searchView.childPanelType())(controller, this.addPanelTitle);
		setupOneViewEventHandler(controller.newInstance(), 'added.cr', panel.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
			}); 
		panel.showUp().then(unblockClick);
	}

	RootItemsPanel.prototype.createRoot = function(objectData, header, onShow)
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
		
		this.navContainer.appendTitle(header);

		var addButton = this.navContainer.appendRightButton()
				.classed('add-button', true)
				.on('click', function(d) {
					if (prepareClick('click', 'edit root objects: add'))
					{
						try
						{
							showClickFeedback(this);
							_this.showAddPanel();
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.preventDefault();
				});
		addButton.append('span').text("+");
	}
	
	function RootItemsPanel(header, onShow)
	{
		EditPanel.call(this);
		
		this.createRoot(null, header, "edit", onShow);

		var _this = this;
		if (this.searchViewType)
		{
			this.searchView = new (this.searchViewType)(this);
			$(this.node()).one('revealing.cr', function() { 
					_this.searchView.search(""); 
					_this.searchView.inputBox.focus();
				});
		}
	}
	
	return RootItemsPanel;
	
})();

var EnumerationSectionEditor = (function() {

    function EnumerationSectionEditor(sitePanel, container, valueFunction, label, pickPanelType)
    {
    	var _this = this;
		this.textContainer = null;
		
		this.section = sitePanel.mainDiv.append('section')
			.classed('cell edit unique', true)
			.datum(container)
			.on('click', 
				function() {
					if (prepareClick('click', 'pick ' + label))
					{
						try
						{
							var panel = new pickPanelType();
							var oldValue = valueFunction.call(container)
							panel.createRoot(container, oldValue ? oldValue.description() : "", label)
								 .showLeft()
								 .then(unblockClick, cr.syncFail);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newValue)
								{
									_this.textContainer.text(newValue ? newValue.description() : "");
									valueFunction.call(container, newValue || null);	/* If newValue is undefined, pass in null to set the value. */
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});
		
		this.section.append('label')
			.text(label);
		
		var oldValue = valueFunction.call(container);	
		var oldDescription = oldValue ? 
						oldValue.description() :
						"";
		var items = sitePanel.appendEnumerationEditor(this.section, oldDescription);
		this.textContainer = items.selectAll('div.description-text');
		
		crf.appendRightChevrons(items);	
    }
    
	return EnumerationSectionEditor;
})();

var GroupPanel = (function () {
	GroupPanel.prototype = Object.create(ChildPanel.prototype);
	GroupPanel.prototype.constructor = GroupPanel;

	GroupPanel.prototype.panelTitle = "Group";
	GroupPanel.prototype.deleteLabel = "Delete Group";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	GroupPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
			return false;
	}
	
	function GroupPanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.group, onShow);
		
		/* Fill in the controls for editing */
		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
									 controller.newInstance().names(),
									 cr.GroupName);

		this.appendChildrenPanelButton(crv.buttonTexts.members, GroupMembersPanel);
		
		/* Add a delete button. */
		this.appendDeleteButton();
	}
	
	return GroupPanel;
})();

var GroupChildSearchView = (function () {
	GroupChildSearchView.prototype = Object.create(ChildSearchView.prototype);
	GroupChildSearchView.prototype.constructor = GroupChildSearchView;

	GroupChildSearchView.prototype.textPath = 'name>text';
	GroupChildSearchView.prototype.pathType = 'group';
	
	GroupChildSearchView.prototype.resultType = function()
	{
		return cr.Group;
	}
	
	GroupChildSearchView.prototype.controllerType = function()
	{
		return GroupController;
	}
	
	GroupChildSearchView.prototype.childPanelType = function()
	{
		return GroupPanel;
	}
	
	function GroupChildSearchView(groupPanel, parent) {
		ChildSearchView.call(this, groupPanel, parent);
	}
	
	return GroupChildSearchView;
})();

var GroupsPanel = (function () {
	GroupsPanel.prototype = Object.create(ChildrenPanel.prototype);
	GroupsPanel.prototype.constructor = GroupsPanel;

	GroupsPanel.prototype.addPanelTitle = "Add Group";
	GroupsPanel.prototype.searchViewType = GroupChildSearchView;
	
	GroupsPanel.prototype.savedItems = function()
	{
		return this.parent.groups();
	}
	
	function GroupsPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.groups, 'list', onShow);
	}
	
	return GroupsPanel;
	
})();

var NewGroupMemberSearchView = (function()
{
	NewGroupMemberSearchView.prototype = Object.create(PickUserSearchView.prototype);
	NewGroupMemberSearchView.prototype.constructor = NewGroupMemberSearchView;

	/* Overrides SearchView.prototype.onClickButton */
	NewGroupMemberSearchView.prototype.onClickButton = function(user, i, button) {
		if (prepareClick('click', 'user: ' + user.description()))
		{
			try
			{
				var _this = this;
				showClickFeedback(button);
				
				var f = function()
					{
						bootstrap_alert.success(
							'{0} added to group "{1}"'
								.format(user.description(), _this.parent.description()));
						unblockClick();
					}
				if (this.parent.id())
				{
					cr.getData({path: this.parent.urlPath() + "/member[user={0}]".format(user.id()),
								resultType: cr.GroupMember,
								})
						.then(function(inquiries)
							{
								if (inquiries.length)
								{
									cr.syncFail(new Error('{0} already a member of group "{1}"'
										.format(user.description(), _this.parent.description())));
								}
								else
								{
									changes = {'members':
										[{'add': '1', 'user': user.urlPath()}]};
									_this.parent.update(changes)
										.then(f, cr.syncFail);
								}
							},
							cr.syncFail);
				}
				else
				{
					var newInstance = new cr.GroupMember();
					newInstance.clientID(uuid.v4());
					newInstance.user(user);
					newInstance.calculateDescription();
					changes = {'members':
						[{'add': newInstance.clientID(), 'user': user.urlPath()}]};
					_this.parent.members().push(newInstance);
					_this.parent.updateData(changes, {});
					f();
				}
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	
	function NewGroupMemberSearchView(sitePanel, parent)
	{
		PickUserSearchView.call(this, sitePanel, parent);
	}
	
	return NewGroupMemberSearchView;
})();

var NewGroupMemberPanel = (function()
{
	NewGroupMemberPanel.prototype = Object.create(crv.SitePanel.prototype);
	NewGroupMemberPanel.prototype.constructor = NewGroupMemberPanel;

	NewGroupMemberPanel.prototype.parent = null;
	function NewGroupMemberPanel(parent, title)
	{
		crv.SitePanel.call(this);
		this.createRoot(parent, title, 'list');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		navContainer.appendTitle(title);

		this.searchView = new NewGroupMemberSearchView(this, parent);
		$(this.node()).one('revealing.cr', function() { 
				_this.searchView.textCleared(); 
				_this.searchView.inputBox.focus();
			});
	}
	
	return NewGroupMemberPanel;
})();

var GroupMemberSearchView = (function () {
	GroupMemberSearchView.prototype = Object.create(ChildSearchView.prototype);
	GroupMemberSearchView.prototype.constructor = GroupMemberSearchView;

	GroupMemberSearchView.prototype.textPath = 'user>email>text';
	GroupMemberSearchView.prototype.pathType = 'member';
	
	GroupMemberSearchView.prototype.resultType = function()
	{
		return cr.GroupMember;
	}
	
	GroupMemberSearchView.prototype.controllerType = function()
	{
		return GroupMemberController;
	}
	
	GroupMemberSearchView.prototype.childPanelType = function()
	{
		return GroupMemberPanel;
	}
	
	GroupMemberSearchView.prototype.onClickButton = function(member, i, button) {
		if (prepareClick('click', 'member: ' + member.description()))
		{
			try
			{
				showClickFeedback(button);
				showUser(member.user());
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	GroupMemberSearchView.prototype.fillItems = function(items)
	{
		ChildSearchView.prototype.fillItems.call(this, items);
		appendInfoButtons(items, function(d)
			{
				return d.user();
			}, 
			function(items) { return items.insert('div', 'button:last-of-type'); });
	}
	
	function GroupMemberSearchView(sitePanel, parent) {
		ChildSearchView.call(this, sitePanel, parent);
	}
	
	return GroupMemberSearchView;
})();

var GroupMembersPanel = (function () {
	GroupMembersPanel.prototype = Object.create(ChildrenPanel.prototype);
	GroupMembersPanel.prototype.constructor = GroupMembersPanel;

	GroupMembersPanel.prototype.addPanelTitle = "Add Group Member";
	GroupMembersPanel.prototype.searchViewType = GroupMemberSearchView;
	
	GroupMembersPanel.prototype.savedItems = function()
	{
		return this.parent.members();
	}
	
	GroupMembersPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var panel = new NewGroupMemberPanel(this.parent, this.addPanelTitle);
		setupOnViewEventHandler(this.parent, 'memberAdded.cr', panel.node(), function(eventObject, newInstance)
			{
				if (_this.parent.id())
					_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
				else
				{
					_this.searchView.showObjects([newInstance]);
				}
			}); 
		panel.showUp().then(unblockClick);
	}
	
	function GroupMembersPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.members, 'list', onShow);
	}
	
	return GroupMembersPanel;
})();

var InquirySearchView = (function () {
	InquirySearchView.prototype = Object.create(ChildSearchView.prototype);
	InquirySearchView.prototype.constructor = InquirySearchView;

	InquirySearchView.prototype.textPath = 'user>email>text';
	InquirySearchView.prototype.pathType = 'inquiry';
	
	InquirySearchView.prototype.resultType = function()
	{
		return cr.Inquiry;
	}
	
	InquirySearchView.prototype.controllerType = function()
	{
		return InquiryController;
	}
	
	InquirySearchView.prototype.childPanelType = function()
	{
		return InquiryPanel;
	}
	
	InquirySearchView.prototype.onClickButton = function(inquiry, i, button) {
		if (prepareClick('click', 'inquiry: ' + inquiry.description()))
		{
			try
			{
				showClickFeedback(button);
				showUser(inquiry.user());
			}
			catch (err) { cr.syncFail(err); }
		}
		d3.event.preventDefault();
	}
	InquirySearchView.prototype.fillItems = function(items)
	{
		ChildSearchView.prototype.fillItems.call(this, items);
		appendInfoButtons(items, function(d)
			{
				return d.user();
			}, 
			function(items) { return items.insert('div', 'button:last-of-type'); });
	}
	
	function InquirySearchView(sitePanel, parent) {
		ChildSearchView.call(this, sitePanel, parent);
	}
	
	return InquirySearchView;
})();

var InquiriesPanel = (function () {
	InquiriesPanel.prototype = Object.create(ChildrenPanel.prototype);
	InquiriesPanel.prototype.constructor = InquiriesPanel;

	InquiriesPanel.prototype.addPanelTitle = "Add Inquiry";
	InquiriesPanel.prototype.searchViewType = InquirySearchView;
	
	InquiriesPanel.prototype.savedItems = function()
	{
		return this.parent.inquiries();
	}
	
	InquiriesPanel.prototype.showAddPanel = function()
	{
		var _this = this;
		var panel = new NewInquiryPanel(this.parent, this.addPanelTitle);
		setupOnViewEventHandler(this.parent, 'inquiryAdded.cr', panel.node(), function(eventObject, newInstance)
			{
				if (_this.parent.id())
					_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
				else
				{
					_this.searchView.showObjects([newInstance]);
				}
			}); 
		panel.showUp().then(unblockClick);
	}
	
	function InquiriesPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.inquiries, 'list', onShow);
	}
	
	return InquiriesPanel;
})();

var OfferingPanel = (function () {
	OfferingPanel.prototype = Object.create(ChildPanel.prototype);
	OfferingPanel.prototype.constructor = OfferingPanel;

	OfferingPanel.prototype.deleteLabel = "Delete Offering";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	OfferingPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.tagPoolSection.reveal() &&
			this.tagPoolSection.reveal().isVisible())
		{
			this.tagPoolSection.checkTagInput(null);
			return true;
		}
		return false;
	}
	
	OfferingPanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		d3.select(inputNode)
			.style('background-color', null)
			.style('border-color', null)
			.style('color', null);
			
		this.tagPoolSection.checkTagInput(inputNode);
		this.tagPoolSection.revealSearchView(inputNode, false);
	}
	
	function OfferingPanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.offering, onShow);
		
		/* Fill in the controls for editing */
		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
									 controller.newInstance().names(),
									 cr.OfferingName);

		this.webSiteSection = this.appendTextSection(controller.newInstance(), cr.Offering.prototype.webSite, crv.buttonTexts.webSite, 'text');
		this.webSiteSection.classed('first', true);
				 
		this.minimumAgeSection = this.appendTextSection(controller.newInstance(), cr.Offering.prototype.minimumAge, crv.buttonTexts.minimumAge, 'number');
		this.minimumAgeSection.classed('first', true);
		this.maximumAgeSection = this.appendTextSection(controller.newInstance(), cr.Offering.prototype.maximumAge, crv.buttonTexts.maximumAge, 'number');
		this.minimumGradeSection = this.appendTextSection(controller.newInstance(), cr.Offering.prototype.minimumGrade, crv.buttonTexts.minimumGrade, 'number');
		this.maximumGradeSection = this.appendTextSection(controller.newInstance(), cr.Offering.prototype.maximumGrade, crv.buttonTexts.maximumGrade, 'number');
				 
		this.appendChildrenPanelButton(crv.buttonTexts.sessions, SessionsPanel);

		/* The tags section. */
		this.tagPoolSection = new TagPoolSection(this.mainDiv, controller, crv.buttonTexts.tags);
		this.tagPoolSection.section.classed('first', true);
		this.tagPoolSection.addAddTagButton();

		var tagsFocused = function(eventObject, inputNode)
			{
				try
				{
					_this.onFocusInTagInput(inputNode);
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			}
		$(this.tagPoolSection).on('tagsFocused.cr', this.node(), tagsFocused);
		$(this.node()).on('clearTriggers.cr remove', null, this.tagPoolSection, 
			function(eventObject)
				{
					$(_this.tagPoolSection).off('tagsFocused.cr', tagsFocused);
				});
				

		this.tagPoolSection.fillTags()
			.then(function()
				{
					_this.tagPoolSection.showTags();
					_this.tagPoolSection.checkTagInput(null);
				},
				cr.asyncFail)
		
		/* Add a delete button. */
		this.appendDeleteButton();
	}
	
	return OfferingPanel;
})();

var OfferingChildSearchView = (function () {
	OfferingChildSearchView.prototype = Object.create(ChildSearchView.prototype);
	OfferingChildSearchView.prototype.constructor = OfferingChildSearchView;

	OfferingChildSearchView.prototype.textPath = 'name>text';
	OfferingChildSearchView.prototype.pathType = 'offering';
	
	OfferingChildSearchView.prototype.resultType = function()
	{
		return cr.Offering;
	}
	
	OfferingChildSearchView.prototype.controllerType = function()
	{
		return OfferingController;
	}
	
	OfferingChildSearchView.prototype.childPanelType = function()
	{
		return OfferingPanel;
	}
	
	function OfferingChildSearchView(offeringPanel, parent) {
		ChildSearchView.call(this, offeringPanel, parent);
	}
	
	return OfferingChildSearchView;
})();

var OfferingsPanel = (function () {
	OfferingsPanel.prototype = Object.create(ChildrenPanel.prototype);
	OfferingsPanel.prototype.constructor = OfferingsPanel;

	OfferingsPanel.prototype.addPanelTitle = "Add Offering";
	OfferingsPanel.prototype.searchViewType = OfferingChildSearchView;
	
	OfferingsPanel.prototype.savedItems = function()
	{
		return this.parent.offerings();
	}
	
	function OfferingsPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.offerings, 'list', onShow);
	}
	
	return OfferingsPanel;
	
})();

var OrganizationPanel = (function () {
	OrganizationPanel.prototype = Object.create(EditItemPanel.prototype);
	OrganizationPanel.prototype.constructor = OrganizationPanel;

	OrganizationPanel.prototype.organization = null;
	OrganizationPanel.prototype.publicAccessLabel = "Public Access";
	OrganizationPanel.prototype.primaryAdministratorLabel = "Primary Administrator";
	OrganizationPanel.prototype.inquiryAccessGroupLabel = "Inquiry Access Group";
	OrganizationPanel.prototype.readLabel = "Public";
	OrganizationPanel.prototype.hiddenLabel = "Hidden";
	
	OrganizationPanel.prototype.publicAccessValue = function(enumValue)
	{
		if (enumValue == OrganizationPanel.prototype.readLabel)
			return 'read';
		else
			return '';
	}
		
    OrganizationPanel.prototype.publicAccessDescription = function()
    {
    	if (this.controller().newInstance().publicAccess() == 'read')
    		return this.readLabel;
    	else
    		return this.hiddenLabel;
    }
    
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	OrganizationPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		return false;
	}
	
	function OrganizationPanel(controller, onShow) {
		var _this = this;
		EditItemPanel.call(this, controller);

		this.createRoot(crv.buttonTexts.organization, onShow);

		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
									 controller.newInstance().names(),
									 cr.OrganizationName);

		this.webSiteSection = this.appendTextSection(controller.newInstance(), cr.Organization.prototype.webSite, crv.buttonTexts.webSite, 'text');
		this.webSiteSection.classed('first', true);
				 
		var publicAccessTextContainer = null;
		
		this.publicAccessSection = this.mainDiv.append('section')
			.classed('cell edit unique first', true)
			.datum(controller.newInstance())
			.on('click', 
				function(d) {
					if (prepareClick('click', 'pick ' + _this.publicAccessLabel))
					{
						try
						{
							var panel = new PickPublicAccessPanel();
							panel.createRoot(d, publicAccessTextContainer.text())
								 .showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newDescription)
								{
									d.publicAccess(_this.publicAccessValue(newDescription));
									publicAccessTextContainer.text(newDescription);
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});
	
		this.publicAccessSection.append('label')
			.text(_this.publicAccessLabel);
			
		var items = this.appendEnumerationEditor(this.publicAccessSection, this.publicAccessDescription());
			
		publicAccessTextContainer = items.selectAll('div.description-text');
	
		crf.appendRightChevrons(items);	
		
		this.primaryAdministratorEditor = new EnumerationSectionEditor(
			this, controller.newInstance(), controller.newInstance().primaryAdministrator, this.primaryAdministratorLabel,
			PickPrimaryAdministratorPanel
			);
		
		this.appendChildrenPanelButton(crv.buttonTexts.sites, SitesPanel);
		this.appendChildrenPanelButton(crv.buttonTexts.groups, GroupsPanel);

		this.inquiryAccessGroupEditor = new EnumerationSectionEditor(
			this, controller.newInstance(), controller.newInstance().inquiryAccessGroup, this.inquiryAccessGroupLabel,
			PickInquiryAccessGroupPanel
			);
	}
	
	return OrganizationPanel;
})();

var PickPublicAccessPanel = (function () {
	PickPublicAccessPanel.prototype = Object.create(PickFromListPanel.prototype);
	PickPublicAccessPanel.prototype.constructor = PickPublicAccessPanel;

	PickPublicAccessPanel.prototype.title = OrganizationPanel.prototype.publicAccessLabel;
	
	PickPublicAccessPanel.prototype.data = function()
	{
		return [{description: OrganizationPanel.prototype.readLabel},
				{description: OrganizationPanel.prototype.hiddenLabel}
			   ];
	}
	
	PickPublicAccessPanel.prototype.datumDescription = function(d)
	{
		return d.description;
	}
	
	PickPublicAccessPanel.prototype.createRoot = function(organization, oldDescription)
	{
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, oldDescription);
	}
	
	function PickPublicAccessPanel() {
		PickFromListPanel.call(this);
	}
	
	return PickPublicAccessPanel;
})();

var PickInquiryAccessGroupSearchView = (function () {
	PickInquiryAccessGroupSearchView.prototype = Object.create(PanelSearchView.prototype);
	PickInquiryAccessGroupSearchView.prototype.constructor = PickInquiryAccessGroupSearchView;

	PickInquiryAccessGroupSearchView.prototype.organization = null;
	
	/* Overrides SearchView.searchPath */
	PickInquiryAccessGroupSearchView.prototype.searchPath = function(val)
	{
		var s = this.organization.urlPath() + "/group";
		if (val.length == 0)
			return s;
		else
		{
			return s + '[name>text^="' + encodeURIComponent(val) + '"]';
		}
	}
	
	PickInquiryAccessGroupSearchView.prototype.increment = function()
	{
		return 20;
	}
	
	PickInquiryAccessGroupSearchView.prototype.fields = function()
	{
		return [];
	}
	
	PickInquiryAccessGroupSearchView.prototype.resultType = function()
	{
		return cr.Group;
	}
	
	PickInquiryAccessGroupSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		if (!d)	/* The first item */
			return true;
			
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
		return i == 0;
	}
	
	PickInquiryAccessGroupSearchView.prototype.textCleared = function()
	{
		PanelSearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	PickInquiryAccessGroupSearchView.prototype.appendButtonContainers = function(foundObjects)
	{
		var _this = this;
		if (this.buttons().size() == 0)
		{
			var items = this.getDataChunker.appendButtonContainers([null]);
			items.on('click', function(d, i) {
				_this.onClickButton(null, i, this);
			})
			items.append('div')
				.classed('description-text growable', true)
				.text(crv.buttonTexts.nullString);
		}
		var items = SearchOptionsView.prototype.appendButtonContainers.call(this, foundObjects);
		items.filter(function(d, i)
			{
				return d.description() == _this.oldDescription;
			})
			.insert('span', ':first-child').classed('glyphicon glyphicon-ok', true);
		return items;
	}
	
	/* Overrides SearchView.prototype.onClickButton */
	PickInquiryAccessGroupSearchView.prototype.onClickButton = function(d, i, button) {
		var _this = this;
		
		if (prepareClick('click', d ? d.description() : "Picked (None)"))
		{
			showClickFeedback(button);
			$(_this.sitePanel.node()).trigger('itemPicked.cr', d);
			_this.sitePanel.hide();
		}
	}
	
	function PickInquiryAccessGroupSearchView(sitePanel, organization, oldDescription) {
		this.organization = organization;
		this.oldDescription = oldDescription;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return PickInquiryAccessGroupSearchView;
})();

var PickInquiryAccessGroupPanel = (function()
{
	PickInquiryAccessGroupPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickInquiryAccessGroupPanel.prototype.constructor = PickInquiryAccessGroupPanel;

	PickInquiryAccessGroupPanel.prototype.organization = null;

	PickInquiryAccessGroupPanel.prototype.createRoot = function(organization, oldDescription, title)
	{
		var _this = this;
		crv.SitePanel.prototype.createRoot.call(this, organization, title, 'list', revealPanelLeft);
		this.navContainer = this.appendNavContainer();

		var _this = this;
		this.appendBackButton();

		this.navContainer.appendTitle(title);

		this.searchView = new PickInquiryAccessGroupSearchView(this, organization, oldDescription);
		$(this.node()).one('revealing.cr', function() {
				_this.searchView.inputText(oldDescription);
				_this.searchView.inputBox.focus();
			});
		return this;
	}
	function PickInquiryAccessGroupPanel()
	{
		crv.SitePanel.call(this);
	}
	
	return PickInquiryAccessGroupPanel;
})();

/*
	Displays a panel from which the user can choose a user to be the primary administrator.
	
	This function should be called within a prepareClick block. 
 */
var PickPrimaryAdministratorPanel = (function() {
	PickPrimaryAdministratorPanel.prototype = Object.create(EditPanel.prototype);
	PickPrimaryAdministratorPanel.prototype.constructor = PickPrimaryAdministratorPanel;

	PickPrimaryAdministratorPanel.prototype.badEmailMessage =
		'Please specify a valid email address.';
	PickPrimaryAdministratorPanel.prototype.emailDocumentation = 
		'Type the email address of the primary administrator for this organization.';
	
	PickPrimaryAdministratorPanel.prototype.showLeft = function()
	{
		var _this = this;
		return EditPanel.prototype.showLeft.call(this)
			.then(function()
				{
					var inputBox = _this.panelDiv.selectAll('input').node();
					inputBox.focus();
					inputBox.setSelectionRange(0, inputBox.value.length);
				});
	}
	
	PickPrimaryAdministratorPanel.prototype.createRoot = function(organization, oldDescription, title)
	{
		var _this = this;
		EditPanel.prototype.createRoot.call(this, organization, title, revealPanelLeft);
		this.navContainer.appendLeftButton()
			.on('click', function()
				{
					if (prepareClick('click', 'Cancel {0}'.format(title)))
					{
						_this.hide();
					}
				})
			.append('span').text('Cancel');
		
		this.navContainer.appendTitle(title);
		
		this.navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Select Primary Administrator'))
				{
					try
					{
						var email = d3.select(_this.node()).selectAll('input').node().value;
						function validateEmail(email) 
						{
							var re = /\S+@\S+\.\S\S+/;
							return re.test(email);
						}
						if (email && !validateEmail(email))
						{
							cr.syncFail(_this.badEmailMessage);
						}
						else
						{
							if (email)
							{
								cr.getData({path: 'user[email>text="{0}"]'.format(email), 
											fields: ['none'], 
											resultType: cr.User})
									.then(function(users)
									{
										try
										{
											if (users.length == 0)
												throw new Error('the email "{0}" is not recognized'.format(email));
											else
											{
												$(_this.node()).trigger('itemPicked.cr', users[0]);
												_this.hide();
											}
										}
										catch(err)
										{
											cr.syncFail(err);
										}
									}, cr.syncFail)
							}
							else
							{
								$(_this.node()).trigger('itemPicked.cr', [null]);
								_this.hide();
							}
						}
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			})
		    .append("span").text(crv.buttonTexts.done);
		
		var sectionPanel = this.mainDiv.append('section')
			.classed('cell edit unique', true);
			
		var itemsDiv = crf.appendItemList(sectionPanel);

		var items = itemsDiv.append("li");	// So that each item appears on its own row.
			
		var emailInput = items.append("input")
			.classed('growable', true)
			.attr("type", "email")
			.attr("placeholder", 'Email')
			.property('value', oldDescription);
			
		var docSection = this.mainDiv.append('section')
			.classed('cell documentation', true);
			
		var docDiv = docSection.append('div')
			.text(this.emailDocumentation);
			
		return this;
	}
	
	function PickPrimaryAdministratorPanel()
	{
		EditPanel.call(this)
	}
	
	return PickPrimaryAdministratorPanel;
})();

var OrganizationSearchView = (function () {
	OrganizationSearchView.prototype = Object.create(RootPanelSearchView.prototype);
	OrganizationSearchView.prototype.constructor = OrganizationSearchView;

	OrganizationSearchView.prototype.searchPathType = 'organization';
	
	/* Overrides SearchView.searchPath */
	OrganizationSearchView.prototype.resultType = function()
	{
		return cr.Organization;
	}
	
	OrganizationSearchView.prototype.controllerType = function()
	{
		return OrganizationController;
	}
	
	OrganizationSearchView.prototype.childPanelType = function()
	{
		return OrganizationPanel;
	}
	
	function OrganizationSearchView(sitePanel) {
		RootPanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return OrganizationSearchView;
})();

var OrganizationsPanel = (function () {
	OrganizationsPanel.prototype = Object.create(RootItemsPanel.prototype);
	OrganizationsPanel.prototype.constructor = OrganizationsPanel;

	OrganizationsPanel.prototype.addPanelTitle = "Add Organization";
	OrganizationsPanel.prototype.searchViewType = OrganizationSearchView;
	
	function OrganizationsPanel(onShow)
	{
		RootItemsPanel.call(this, crv.buttonTexts.organizations, onShow);
	}
	
	return OrganizationsPanel;
	
})();

var PickStagePanel = (function () {
	PickStagePanel.prototype = Object.create(PickFromListPanel.prototype);
	PickStagePanel.prototype.constructor = PickStagePanel;

	PickStagePanel.prototype.title = crv.buttonTexts.stage;
	
	PickStagePanel.prototype.data = function()
	{
		return [{code: '', name: crv.buttonTexts.nullString},
				{code: 'Housing', name: 'Housing'},
				{code: 'Studying', name: 'Studying'},
				{code: 'Certificate', name: 'Certificate'},
				{code: 'Training', name: 'Training'},
				{code: 'Whatever', name: 'Interest'},
				{code: 'Working', name: 'Working'},
				{code: 'Teaching', name: 'Teaching'},
				{code: 'Expert', name: 'Expert'},
				{code: 'Skills', name: 'Skills'},
				{code: 'Mentoring', name: 'Mentoring'},
				{code: 'Tutoring', name: 'Tutoring'},
				{code: 'Coaching', name: 'Coaching'},
				{code: 'Volunteering', name: 'Volunteering'},
				{code: 'Wellness', name: 'Wellness'},
			   ];
	}
	
	PickStagePanel.prototype.isInitialValue = function(d)
	{
		return d.code === this.initialValue;
	}

	PickStagePanel.prototype.pickedValue = function(d)
	{
		return d.code;
	}

	PickStagePanel.prototype.datumDescription = function(d)
	{
		return d.name;
	}
	
	PickStagePanel.prototype.getDescription = function(storedValue)
	{
		return storedValue || crv.buttonTexts.nullString;
	}

	PickStagePanel.prototype.createRoot = function(user, initialValue)
	{
		this.initialValue = initialValue;
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, initialValue);
	}
	
	function PickStagePanel() {
		PickFromListPanel.call(this);
	}
	
	return PickStagePanel;
})();

var ServiceTagSearchView = (function () {
	ServiceTagSearchView.prototype = Object.create(TagSearchView.prototype);
	ServiceTagSearchView.prototype.constructor = ServiceTagSearchView;
	
    ServiceTagSearchView.prototype.setFlagVisibles = function(inputNode)
    {
    	TagSearchView.prototype.setFlagVisibles.call(this, inputNode);
    	
    	/* If there is no text, add all of the services that are implied by a 
    		service that is already selected.
    	 */
    	if (!inputNode.value)
    	{
    		var container = this.poolSection.section.select('.tags-container');
			var tagDivs = container.selectAll('input.tag');
			
			var implications = [];
			var setServices = tagDivs.data();
			tagDivs.each(function(si1)
				{
					if (si1)
					{
						si1.service().serviceImplications().forEach(function(si2)
							{
								if (!(si2.service().id() in implications || 
									  setServices.find(function(si3) { return si3 && si3.service().id() == si2.service().id(); })))
									implications.push(si2.service().id());
							});
					}
				});
				
			this.flags().each(function(sd)
				{
					console.assert(sd.service);
					if (implications.find(function(s) { return s == sd.service.id(); }))
						sd.visible = true;
				});
		}
    }
	
	function ServiceTagSearchView(container, poolSection, controller)
	{
		TagSearchView.call(this, container, poolSection, controller);
	}
	
	return ServiceTagSearchView;
})();

var ServicePanel = (function () {
	ServicePanel.prototype = Object.create(EditItemPanel.prototype);
	ServicePanel.prototype.constructor = ServicePanel;

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	ServicePanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.tagPoolSection.reveal() &&
			this.tagPoolSection.reveal().isVisible())
		{
			this.tagPoolSection.checkTagInput(null);
			return true;
		}
		return false;
	}
	
	ServicePanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		d3.select(inputNode)
			.style('background-color', null)
			.style('border-color', null)
			.style('color', null);
			
		this.tagPoolSection.checkTagInput(inputNode);
		this.tagPoolSection.revealSearchView(inputNode, false);
	}
	
	function ServicePanel(controller, onShow) {
		var _this = this;
		EditItemPanel.call(this, controller);

		this.createRoot(crv.buttonTexts.service, onShow);

		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
									 controller.newInstance().names(),
									 cr.ServiceName);

		this.appendTranslationsSection(controller.newInstance(), 
			crv.buttonTexts.organizationLabels, crv.buttonTexts.organizationLabel, 
			controller.newInstance().organizationLabels(),
			cr.ServiceOrganizationLabel);

		this.appendTranslationsSection(controller.newInstance(), 
			crv.buttonTexts.siteLabels, crv.buttonTexts.siteLabel, 
			controller.newInstance().siteLabels(),
			cr.ServiceSiteLabel);

		this.appendTranslationsSection(controller.newInstance(), 
			crv.buttonTexts.offeringLabels, crv.buttonTexts.offeringLabel, 
			controller.newInstance().offeringLabels(),
			cr.ServiceOfferingLabel);

		this.stageSection = this.appendEnumerationPickerSection(controller.newInstance(), controller.newInstance().stage, crv.buttonTexts.stage, PickStagePanel)
		this.stageSection.classed('first', true);

		/* The tags section. */
		this.tagPoolSection = new TagPoolSection(this.mainDiv, controller, crv.buttonTexts.implications, ServiceTagSearchView);
		this.tagPoolSection.section.classed('first', true);
		this.tagPoolSection.addAddTagButton();

		var tagsFocused = function(eventObject, inputNode)
			{
				try
				{
					_this.onFocusInTagInput(inputNode);
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			}
		$(this.tagPoolSection).on('tagsFocused.cr', this.node(), tagsFocused);
		$(this.node()).on('clearTriggers.cr remove', null, this.tagPoolSection, 
			function(eventObject)
				{
					$(_this.tagPoolSection).off('tagsFocused.cr', tagsFocused);
				});
				

		this.tagPoolSection.fillTags()
			.then(function()
				{
					_this.tagPoolSection.showTags();
					_this.tagPoolSection.checkTagInput(null);
				},
				cr.asyncFail)
		
	}
	
	return ServicePanel;
})();

var ServiceSearchView = (function () {
	ServiceSearchView.prototype = Object.create(RootPanelSearchView.prototype);
	ServiceSearchView.prototype.constructor = ServiceSearchView;

	ServiceSearchView.prototype.searchPathType = 'service';
	
	/* Overrides SearchView.searchPath */
	ServiceSearchView.prototype.resultType = function()
	{
		return cr.Service;
	}
	
	ServiceSearchView.prototype.controllerType = function()
	{
		return ServiceController;
	}
	
	ServiceSearchView.prototype.childPanelType = function()
	{
		return ServicePanel;
	}
	
	function ServiceSearchView(sitePanel) {
		RootPanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return ServiceSearchView;
})();

var ServicesPanel = (function () {
	ServicesPanel.prototype = Object.create(RootItemsPanel.prototype);
	ServicesPanel.prototype.constructor = ServicesPanel;

	ServicesPanel.prototype.panelTitle = "Services";
	ServicesPanel.prototype.addPanelTitle = "Add Service";
	ServicesPanel.prototype.searchViewType = ServiceSearchView;
	
	function ServicesPanel(onShow)
	{
		RootItemsPanel.call(this, this.panelTitle, onShow);
	}
	
	return ServicesPanel;
	
})();

var SessionPanel = (function () {
	SessionPanel.prototype = Object.create(ChildPanel.prototype);
	SessionPanel.prototype.constructor = SessionPanel;

	SessionPanel.prototype.deleteLabel = "Delete Session";
	
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
	
	function SessionPanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.session, onShow);
		
		/* Fill in the controls for editing */
		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
									 controller.newInstance().names(),
									 cr.SessionName);
									 
		this.registrationDeadlineSection = this.appendDateSection(controller.newInstance(), controller.newInstance().registrationDeadline, crv.buttonTexts.registrationDeadline);
		this.registrationDeadlineEditor = this.registrationDeadlineSection.editor;
		this.registrationDeadlineSection.classed('first', true);
		
		this.startSection = this.appendDateSection(controller.newInstance(), controller.newInstance().start, crv.buttonTexts.start);
		this.startEditor = this.startSection.editor;
		this.endSection = this.appendDateSection(controller.newInstance(), controller.newInstance().end, crv.buttonTexts.end);
		this.endEditor = this.endSection.editor;

		this.canRegisterSection = this.appendEnumerationPickerSection(controller.newInstance(), controller.newInstance().canRegister, crv.buttonTexts.canRegister, PickCanRegisterPanel)
		this.canRegisterSection.classed('first', true);
				 
		this.appendChildrenPanelButton(crv.buttonTexts.inquiries, InquiriesPanel);
		this.appendChildrenPanelButton(crv.buttonTexts.enrollments, EnrollmentsPanel);
		this.appendChildrenPanelButton(crv.buttonTexts.engagements, EngagementsPanel);
		this.appendChildrenPanelButton(crv.buttonTexts.periods, PeriodsPanel);
		
		/* Add a delete button. */
		this.appendDeleteButton();
	}
	
	return SessionPanel;
})();

var SessionSearchView = (function () {
	SessionSearchView.prototype = Object.create(ChildSearchView.prototype);
	SessionSearchView.prototype.constructor = SessionSearchView;

	SessionSearchView.prototype.textPath = 'name>text';
	SessionSearchView.prototype.pathType = 'session';
	
	SessionSearchView.prototype.resultType = function()
	{
		return cr.Session;
	}
	
	SessionSearchView.prototype.controllerType = function()
	{
		return SessionController;
	}
	
	SessionSearchView.prototype.childPanelType = function()
	{
		return SessionPanel;
	}
	
	function SessionSearchView(sessionPanel, parent) {
		ChildSearchView.call(this, sessionPanel, parent);
	}
	
	return SessionSearchView;
})();

var SessionsPanel = (function () {
	SessionsPanel.prototype = Object.create(ChildrenPanel.prototype);
	SessionsPanel.prototype.constructor = SessionsPanel;

	SessionsPanel.prototype.addPanelTitle = "Add Session";
	SessionsPanel.prototype.searchViewType = SessionSearchView;
	
	SessionsPanel.prototype.savedItems = function()
	{
		return this.parent.sessions();
	}
	
	function SessionsPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.sessions, 'list', onShow);
	}
	
	return SessionsPanel;
	
})();

var SitePanel = (function () {
	SitePanel.prototype = Object.create(ChildPanel.prototype);
	SitePanel.prototype.constructor = SitePanel;

	SitePanel.prototype.panelTitle = "Site";
	SitePanel.prototype.deleteLabel = "Delete Site";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	SitePanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
			return false;
	}
	
	function SitePanel(controller, onShow) {
		ChildPanel.call(this, controller);
		
		var _this = this;

		this.createRoot(crv.buttonTexts.site, onShow);
		
		/* Fill in the controls for editing */
		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
									 controller.newInstance().names(),
									 cr.SiteName);

		this.webSiteSection = this.appendTextSection(controller.newInstance(), cr.Site.prototype.webSite, crv.buttonTexts.webSite, 'text');
		this.webSiteSection.classed('first', true);
				 
		this.addressSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit unique first', true)
			.on('click', function(d) {
				if (prepareClick('click', 'Address'))
				{
					showClickFeedback(this);
					try
					{
						var address = d.address();
						var addressController = new AddressController(d, address);
						addressController.oldInstance(address);
						var panel = new AddressPanel(addressController, revealPanelLeft);
						panel.showLeft().then(unblockClick);
						setupOnViewEventHandler(address, 'changed.cr', this, function(eventObject)
							{
								d3.select(eventObject.data).selectAll('div.description-text')
									.text(address.description() || crv.buttonTexts.nullString);
							});
					}
					catch(err) { cr.syncFail(err); }
				}
			});
		this.addressSection.append('label')
			.text(crv.buttonTexts.address);
		this.appendEnumerationEditor(this.addressSection, controller.newInstance().address().description() || crv.buttonTexts.nullString);
		crf.appendRightChevrons(this.addressSection.selectAll('li'));	

		this.appendChildrenPanelButton(crv.buttonTexts.offerings, OfferingsPanel);

		/* Add a delete button. */
		this.appendDeleteButton();
	}
	
	return SitePanel;
})();

var SiteChildSearchView = (function () {
	SiteChildSearchView.prototype = Object.create(ChildSearchView.prototype);
	SiteChildSearchView.prototype.constructor = SiteChildSearchView;

	SiteChildSearchView.prototype.textPath = 'name>text';
	SiteChildSearchView.prototype.pathType = 'site';
	
	SiteChildSearchView.prototype.resultType = function()
	{
		return cr.Site;
	}
	
	SiteChildSearchView.prototype.controllerType = function()
	{
		return SiteController;
	}
	
	SiteChildSearchView.prototype.childPanelType = function()
	{
		return SitePanel;
	}
	
	function SiteChildSearchView(sitePanel, parent) {
		ChildSearchView.call(this, sitePanel, parent);
	}
	
	return SiteChildSearchView;
})();

var SitesPanel = (function () {
	SitesPanel.prototype = Object.create(ChildrenPanel.prototype);
	SitesPanel.prototype.constructor = SitesPanel;

	SitesPanel.prototype.addPanelTitle = "Add Site";
	SitesPanel.prototype.searchViewType = SiteChildSearchView;
	
	SitesPanel.prototype.savedItems = function()
	{
		return this.parent.sites();
	}
	
	function SitesPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.sites, 'list', onShow);
	}
	
	return SitesPanel;
	
})();

var UserPanel = (function () {
	UserPanel.prototype = Object.create(EditItemPanel.prototype);
	UserPanel.prototype.constructor = UserPanel;

	UserPanel.prototype.user = null;
	UserPanel.prototype.publicAccessLabel = "Public Access";
	UserPanel.prototype.primaryAdministratorLabel = "Primary Administrator";
	UserPanel.prototype.readLabel = "Public";
	UserPanel.prototype.hiddenLabel = "Hidden";
	
	UserPanel.prototype.publicAccessValue = function(enumValue)
	{
		if (enumValue == crv.buttonTexts.readPublicAccess)
			return 'read';
		else
			return '';
	}
		
    UserPanel.prototype.publicAccessDescription = function()
    {
    	if (this.controller().newInstance().publicAccess() == 'read')
    		return crv.buttonTexts.readPublicAccess;
    	else
    		return crv.buttonTexts.noPublicAccess;
    }
    
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	UserPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		return false;
	}
	
	function UserPanel(controller, onShow) {
		var _this = this;
		EditItemPanel.call(this, controller);

		this.createRoot(crv.buttonTexts.user, onShow);

		this.emailsSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit multiple', true);
		this.emailsSection.append('label')
			.text(crv.buttonTexts.emails);
		this.appendOrderedTextEditor(this.emailsSection, controller.newInstance(), crv.buttonTexts.emails, crv.buttonTexts.email, 
									 controller.newInstance().emails(),
									 cr.UserEmail);

		this.firstNameSection = this.appendTextSection(controller.newInstance(), controller.newInstance().firstName, crv.buttonTexts.firstName, 'text')
			.classed('first', true);
			
		this.lastNameSection = this.appendTextSection(controller.newInstance(), controller.newInstance().lastName, crv.buttonTexts.lastName, 'text');
		
		var publicAccessTextContainer = null;
		
		this.publicAccessSection = this.mainDiv.append('section')
			.classed('cell edit unique first', true)
			.datum(controller.newInstance())
			.on('click', 
				function(d) {
					if (prepareClick('click', crv.buttonTexts.publicAccess))
					{
						try
						{
							var panel = new PickPublicAccessPanel();
							panel.createRoot(d, publicAccessTextContainer.text())
								 .showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newDescription)
								{
									d.publicAccess(_this.publicAccessValue(newDescription));
									publicAccessTextContainer.text(newDescription);
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});
	
		this.publicAccessSection.append('label')
			.text(crv.buttonTexts.publicAccess);
			
		var items = this.appendEnumerationEditor(this.publicAccessSection, this.publicAccessDescription());
			
		publicAccessTextContainer = items.selectAll('div.description-text');
	
		crf.appendRightChevrons(items);	
		
		this.primaryAdministratorEditor = new EnumerationSectionEditor(
			this, controller.newInstance(), controller.newInstance().primaryAdministrator, this.primaryAdministratorLabel,
			PickPrimaryAdministratorPanel
			);
			
		if (controller.newInstance().id() && controller.newInstance().privilege() == 'administer')
		{
			var _this = this;
			this.appendActionButton("Reset Password", function() {
				if (prepareClick('click', "Reset Password"))
				{
					showClickFeedback(this);
					try
					{
						if (controller.newInstance().emails.length == 0)
							cr.syncFail("Please specify an email address.");
						else
						{
							bootstrap_alert.success('Resetting password (this may take a few minutes)...');
		
							$.post(cr.urls.resetPassword, 
								{ email: controller.newInstance().emails()[0].text()
								})
							 .then(function()
								{
									bootstrap_alert.close();
									bootstrap_alert.success('This password has been reset.');
									unblockClick();
								},
								cr.thenFail)
							  .fail(cr.syncFail);
						}
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
		}
	}
	
	return UserPanel;
})();

var UserSearchView = (function () {
	UserSearchView.prototype = Object.create(RootPanelSearchView.prototype);
	UserSearchView.prototype.constructor = UserSearchView;

	UserSearchView.prototype.searchPathType = 'user';
	UserSearchView.prototype.searchPathTextField = 'email>text';
	
	/* Overrides SearchView.searchPath */
	UserSearchView.prototype.resultType = function()
	{
		return cr.User;
	}
	
	UserSearchView.prototype.controllerType = function()
	{
		return UserController;
	}
	
	UserSearchView.prototype.childPanelType = function()
	{
		return UserPanel;
	}
	
	UserSearchView.prototype.fillItems = function(items)
	{
		ChildSearchView.prototype.fillItems.call(this, items);
		appendInfoButtons(items, undefined, 
			function(items) { return items.insert('div', 'button:last-of-type'); });
	}
	
	function UserSearchView(sitePanel) {
		RootPanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return UserSearchView;
})();

var UsersPanel = (function () {
	UsersPanel.prototype = Object.create(RootItemsPanel.prototype);
	UsersPanel.prototype.constructor = UsersPanel;

	UsersPanel.prototype.panelTitle = "Users";
	UsersPanel.prototype.addPanelTitle = "Add User";
	UsersPanel.prototype.searchViewType = UserSearchView;
	
	function UsersPanel(onShow)
	{
		RootItemsPanel.call(this, this.panelTitle, onShow);
	}
	
	return UsersPanel;
	
})();

var CommentPromptPanel = (function () {
	CommentPromptPanel.prototype = Object.create(EditItemPanel.prototype);
	CommentPromptPanel.prototype.constructor = CommentPromptPanel;

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	CommentPromptPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		return false;
	}
	
	function CommentPromptPanel(controller, onShow) {
		var _this = this;
		EditItemPanel.call(this, controller);

		this.createRoot(crv.buttonTexts.commentPrompt, onShow);

		this.namesSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.texts, crv.buttonTexts.text, 
									 controller.newInstance().translations(),
									 cr.CommentPromptText);

	}
	
	return CommentPromptPanel;
})();

var CommentPromptSearchView = (function () {
	CommentPromptSearchView.prototype = Object.create(RootPanelSearchView.prototype);
	CommentPromptSearchView.prototype.constructor = CommentPromptSearchView;

	CommentPromptSearchView.prototype.searchPathType = 'comment prompt';
	CommentPromptSearchView.prototype.searchPathTextField = 'translation>text';
	
	/* Overrides SearchView.searchPath */
	CommentPromptSearchView.prototype.resultType = function()
	{
		return cr.CommentPrompt;
	}
	
	CommentPromptSearchView.prototype.controllerType = function()
	{
		return CommentPromptController;
	}
	
	CommentPromptSearchView.prototype.childPanelType = function()
	{
		return CommentPromptPanel;
	}
	
	function CommentPromptSearchView(sitePanel) {
		RootPanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return CommentPromptSearchView;
})();

var CommentPromptsPanel = (function () {
	CommentPromptsPanel.prototype = Object.create(RootItemsPanel.prototype);
	CommentPromptsPanel.prototype.constructor = CommentPromptsPanel;

	CommentPromptsPanel.prototype.panelTitle = "Comment Prompts";
	CommentPromptsPanel.prototype.addPanelTitle = "Add Comment Prompt";
	CommentPromptsPanel.prototype.searchViewType = CommentPromptSearchView;
	
	function CommentPromptsPanel(onShow)
	{
		RootItemsPanel.call(this, this.panelTitle, onShow);
	}
	
	return CommentPromptsPanel;
	
})();

var LinkSearchView = (function () {
	LinkSearchView.prototype = Object.create(PanelSearchView.prototype);
	LinkSearchView.prototype.constructor = LinkSearchView;

	LinkSearchView.prototype.increment = function() { return 20; }

	LinkSearchView.prototype.fields = function() { return []; }

	LinkSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
		
		if (!d)	/* The first item */
			return true;
		
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
		return i == 0;
	}

	LinkSearchView.prototype.textCleared = function()
	{
		PanelSearchView.prototype.textCleared.call(this);
		this.startSearchTimeout("");
	}

	LinkSearchView.prototype.appendButtonContainers = function(foundObjects)
	{
		var _this = this;
		if (this.buttons().size() == 0)
		{
			var items = this.getDataChunker.appendButtonContainers([null]);
			items.on('click', function(d, i) {
				_this.onClickButton(null, i, this);
			})
			items.append('div')
				.classed('description-text growable', true)
				.text(crv.buttonTexts.nullString);
		}
		var items = SearchOptionsView.prototype.appendButtonContainers.call(this, foundObjects);
		items.filter(function(d, i)
			{
				return d.description() == _this.oldDescription;
			})
			.insert('span', ':first-child').classed('glyphicon glyphicon-ok', true);
		return items;
	}

	/* Overrides SearchView.prototype.onClickButton */
	LinkSearchView.prototype.onClickButton = function(d, i, button) {
		var _this = this;
	
		if (prepareClick('click', d ? d.description() : "Picked (None)"))
		{
			showClickFeedback(button);
			$(_this.sitePanel.node()).trigger('itemPicked.cr', d);
			_this.sitePanel.hide();
		}
	}

	function LinkSearchView(sitePanel, oldDescription) {
		this.oldDescription = oldDescription;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}

	return LinkSearchView;
})();

var PickOrganizationPanel = (function()
{
	PickOrganizationPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickOrganizationPanel.prototype.constructor = PickOrganizationPanel;

	PickOrganizationPanel.prototype.createRoot = function(organization, oldDescription)
	{
		var _this = this;
		crv.SitePanel.prototype.createRoot.call(this, null, crv.buttonTexts.pickOrganization, 'list', revealPanelLeft);
		this.navContainer = this.appendNavContainer();

		this.appendBackButton();

		this.navContainer.appendTitle(crv.buttonTexts.pickOrganization);

		this.searchView = new PickOrganizationPanel.SV(this, organization, oldDescription);
		$(this.node()).one('revealing.cr', function() {
				_this.searchView.inputText(oldDescription);
				_this.searchView.inputBox.focus();
			});
		return this;
	}
	function PickOrganizationPanel()
	{
		crv.SitePanel.call(this);
	}
	
	PickOrganizationPanel.SV = (function () {
		SV.prototype = Object.create(LinkSearchView.prototype);
		SV.prototype.constructor = SV;

		/* Overrides SearchView.searchPath */
		SV.prototype.searchPath = function(val)
		{
			var s = "organization";
			if (val.length == 0)
				return s;
			else
			{
				return s + '[name>text^="' + encodeURIComponent(val) + '"]';
			}
		}
	
		SV.prototype.resultType = function() { return cr.Organization; }
	
		function SV(sitePanel, oldDescription) {
			LinkSearchView.call(this, sitePanel, oldDescription);
		}
	
		return SV;
	})();

	return PickOrganizationPanel;
})();

var PickSitePanel = (function()
{
	PickSitePanel.prototype = Object.create(crv.SitePanel.prototype);
	PickSitePanel.prototype.constructor = PickSitePanel;

	PickSitePanel.prototype.createRoot = function(site, oldDescription)
	{
		var _this = this;
		crv.SitePanel.prototype.createRoot.call(this, null, crv.buttonTexts.pickSite, 'list', revealPanelLeft);
		this.navContainer = this.appendNavContainer();

		this.appendBackButton();

		this.navContainer.appendTitle(crv.buttonTexts.pickSite);

		this.searchView = new PickSitePanel.SV(this, site, oldDescription);
		$(this.node()).one('revealing.cr', function() {
				_this.searchView.inputText(oldDescription);
				_this.searchView.inputBox.focus();
			});
		return this;
	}
	function PickSitePanel()
	{
		crv.SitePanel.call(this);
	}
	
	PickSitePanel.SV = (function () {
		SV.prototype = Object.create(LinkSearchView.prototype);
		SV.prototype.constructor = SV;

		/* Overrides SearchView.searchPath */
		SV.prototype.searchPath = function(val)
		{
			var s = "site";
			if (val.length == 0)
				return s;
			else
			{
				return s + '[name>text^="' + encodeURIComponent(val) + '"]';
			}
		}
	
		SV.prototype.resultType = function() { return cr.Site; }
	
		function SV(sitePanel, oldDescription) {
			LinkSearchView.call(this, sitePanel, oldDescription);
		}
	
		return SV;
	})();

	return PickSitePanel;
})();

var PickOfferingPanel = (function()
{
	PickOfferingPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickOfferingPanel.prototype.constructor = PickOfferingPanel;

	PickOfferingPanel.prototype.createRoot = function(offering, oldDescription)
	{
		var _this = this;
		crv.SitePanel.prototype.createRoot.call(this, null, crv.buttonTexts.pickOffering, 'list', revealPanelLeft);
		this.navContainer = this.appendNavContainer();

		this.appendBackButton();

		this.navContainer.appendTitle(crv.buttonTexts.pickOffering);

		this.searchView = new PickOfferingPanel.SV(this, offering, oldDescription);
		$(this.node()).one('revealing.cr', function() {
				_this.searchView.inputText(oldDescription);
				_this.searchView.inputBox.focus();
			});
		return this;
	}
	function PickOfferingPanel()
	{
		crv.SitePanel.call(this);
	}
	
	PickOfferingPanel.SV = (function () {
		SV.prototype = Object.create(LinkSearchView.prototype);
		SV.prototype.constructor = SV;

		/* Overrides SearchView.searchPath */
		SV.prototype.searchPath = function(val)
		{
			var s = "offering";
			if (val.length == 0)
				return s;
			else
			{
				return s + '[name>text^="' + encodeURIComponent(val) + '"]';
			}
		}
	
		SV.prototype.resultType = function() { return cr.Offering; }
	
		function SV(sitePanel, oldDescription) {
			LinkSearchView.call(this, sitePanel, oldDescription);
		}
	
		return SV;
	})();

	return PickOfferingPanel;
})();

var PickServicePanel = (function()
{
	PickServicePanel.prototype = Object.create(crv.SitePanel.prototype);
	PickServicePanel.prototype.constructor = PickServicePanel;

	PickServicePanel.prototype.createRoot = function(service, oldDescription)
	{
		var _this = this;
		crv.SitePanel.prototype.createRoot.call(this, null, crv.buttonTexts.pickService, 'list', revealPanelLeft);
		this.navContainer = this.appendNavContainer();

		this.appendBackButton();

		this.navContainer.appendTitle(crv.buttonTexts.pickService);

		this.searchView = new PickServicePanel.SV(this, service, oldDescription);
		$(this.node()).one('revealing.cr', function() {
				_this.searchView.inputText(oldDescription);
				_this.searchView.inputBox.focus();
			});
		return this;
	}
	
	function PickServicePanel()
	{
		crv.SitePanel.call(this);
	}
	
	PickServicePanel.SV = (function () {
		SV.prototype = Object.create(LinkSearchView.prototype);
		SV.prototype.constructor = SV;

		/* Overrides SearchView.searchPath */
		SV.prototype.searchPath = function(val)
		{
			var s = "service";
			if (val.length == 0)
				return s;
			else
			{
				return s + '[name>text^="' + encodeURIComponent(val) + '"]';
			}
		}
	
		SV.prototype.resultType = function() { return cr.Offering; }
	
		function SV(servicePanel, oldDescription) {
			LinkSearchView.call(this, servicePanel, oldDescription);
		}
	
		return SV;
	})();

	return PickServicePanel;
})();

var PickTimeframePanel = (function () {
	PickTimeframePanel.prototype = Object.create(PickFromListPanel.prototype);
	PickTimeframePanel.prototype.constructor = PickTimeframePanel;

	PickTimeframePanel.prototype.title = crv.buttonTexts.timeframe;
	
	PickTimeframePanel.prototype.data = function()
	{
		return [{code: '', name: crv.buttonTexts.nonePlaceholder},
				{code: 'Previous', name: crv.buttonTexts.previousTimeframe},
				{code: 'Current', name: crv.buttonTexts.currentTimeframe},
				{code: 'Goal', name: crv.buttonTexts.goalTimeframe},
			   ];
	}
	
	PickTimeframePanel.prototype.isInitialValue = function(d)
	{
		return d.code === this.initialValue;
	}

	PickTimeframePanel.prototype.pickedValue = function(d)
	{
		return d.code;
	}

	PickTimeframePanel.prototype.datumDescription = function(d)
	{
		return d.name;
	}
	
	PickTimeframePanel.prototype.createRoot = function(user, initialValue)
	{
		this.initialValue = initialValue;
		return PickFromListPanel.prototype.createRoot.call(this, null, this.title, initialValue);
	}
	
	function PickTimeframePanel() {
		PickFromListPanel.call(this);
	}
	
	PickTimeframePanel.prototype.getDescription = function(storedValue)
	{
		var d = PickTimeframePanel.prototype.data.call(null).find(function(d)
			{
				return d.code == storedValue;
			})
		return d && d.name;
	}

	return PickTimeframePanel;
})();

var ExperiencePromptPanel = (function () {
	ExperiencePromptPanel.prototype = Object.create(EditItemPanel.prototype);
	ExperiencePromptPanel.prototype.constructor = ExperiencePromptPanel;

	ExperiencePromptPanel.prototype.title = crv.buttonTexts.experiencePrompt;
	
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	ExperiencePromptPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.tagsSection.reveal() &&
			this.tagsSection.reveal().isVisible())
		{
			this.tagsSection.checkTagInput(null);
			this.tagsSection.hideReveal(done);
			return true;
		}
		else if (newReveal != this.disqualifyingTagsSection.reveal() &&
			this.disqualifyingTagsSection.reveal().isVisible())
		{
			this.disqualifyingTagsSection.checkTagInput(null);
			this.disqualifyingTagsSection.hideReveal(done);
			return true;
		}
		return false;
	}
	
	ExperiencePromptPanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		d3.select(inputNode)
			.style('background-color', null)
			.style('border-color', null)
			.style('color', null);
			
		this.tagsSection.checkTagInput(inputNode);
		this.tagsSection.revealSearchView(inputNode, false);
	}
	
	ExperiencePromptPanel.prototype.onFocusInDisqualifyingTagInput = function(inputNode)
	{
		var _this = this;
		d3.select(inputNode)
			.style('background-color', null)
			.style('border-color', null)
			.style('color', null);
			
		this.disqualifyingTagsSection.checkTagInput(inputNode);
		this.disqualifyingTagsSection.revealSearchView(inputNode, false);
	}
	
	function ExperiencePromptPanel(controller, onShow) {
		var _this = this;
		EditItemPanel.call(this, controller);

		this.createRoot(crv.buttonTexts.experiencePrompt, onShow);

		this.nameSection = this.appendTextSection(controller.newInstance(), controller.newInstance().name, crv.buttonTexts.name, 'text');

		this.organizationSection = this.appendLinkSection(controller.newInstance().organization, crv.buttonTexts.organization, PickOrganizationPanel);
		this.organizationSection.classed('first', true);

		this.siteSection = this.appendLinkSection(controller.newInstance().site, crv.buttonTexts.site, PickSitePanel);
		this.offeringSection = this.appendLinkSection(controller.newInstance().offering, crv.buttonTexts.offering, PickOfferingPanel);
		
		this.domainSection = this.appendLinkSection(controller.newInstance().domain, crv.buttonTexts.domain, PickServicePanel);
		this.domainSection.classed('first', true);

		this.stageSection = this.appendEnumerationPickerSection(controller.newInstance(), controller.newInstance().stage, crv.buttonTexts.stage, PickStagePanel)
		this.stageSection.classed('first', true);

		this.timeframeSection = this.appendEnumerationPickerSection(controller.newInstance(), controller.newInstance().stage, crv.buttonTexts.timeframe, PickTimeframePanel)
		this.timeframeSection.classed('first', true);

		/* Fill in the controls for editing */
		this.translationsSection = this.appendTranslationsSection(controller.newInstance(), crv.buttonTexts.texts, crv.buttonTexts.text, 
									 controller.newInstance().translations(),
									 cr.ExperiencePromptText);

		/* The tags section. */
		this.tagsSection = new TagPoolSection(this.mainDiv, 
			new ExperiencePromptServicesController(controller.newInstance()), 
			crv.buttonTexts.tags);
		this.tagsSection.section.classed('first', true);
		this.tagsSection.addAddTagButton();

		var tagsFocused = function(eventObject, inputNode)
			{
				try
				{
					var done = function()
						{
							_this.onFocusInTagInput(inputNode);
						}
					if (!_this.onFocusInOtherInput(_this.tagsSection.reveal(), done))
						done();
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			}
		$(this.tagsSection).on('tagsFocused.cr', this.node(), tagsFocused);
		$(this.node()).on('clearTriggers.cr remove', null, this.tagsSection, 
			function(eventObject)
				{
					$(_this.tagsSection).off('tagsFocused.cr', tagsFocused);
				});
				

		this.tagsSection.fillTags()
			.then(function()
				{
					_this.tagPoolSection.showTags();
					_this.tagsSection.checkTagInput(null);
				},
				cr.asyncFail)
		
		this.disqualifyingTagsSection = new TagPoolSection(this.mainDiv, 
			new DisqualifyingTagsController(controller.newInstance()), 
			crv.buttonTexts.disqualifyingTags)
			.classed('first', true);
			
		this.disqualifyingTagsSection.addAddTagButton();

		var disqualifyingTagsFocused = function(eventObject, inputNode)
			{
				try
				{
					var done = function()
						{
							_this.onFocusInDisqualifyingTagInput(inputNode);
						}
					if (!_this.onFocusInOtherInput(_this.disqualifyingTagsSection.reveal(), done))
						done();
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			}
		$(this.disqualifyingTagsSection).on('tagsFocused.cr', this.node(), disqualifyingTagsFocused);
		$(this.node()).on('clearTriggers.cr remove', null, this.disqualifyingTagsSection, 
			function(eventObject)
				{
					$(_this.disqualifyingTagsSection).off('tagsFocused.cr', disqualifyingTagsFocused);
				});
				
		this.disqualifyingTagsSection.fillTags()
			.then(function()
				{
					_this.disqualifyingTagsSection.showTags();
					_this.disqualifyingTagsSection.checkTagInput(null);
				},
				cr.asyncFail)
	}
	
	return ExperiencePromptPanel;
})();

var ExperiencePromptSearchView = (function () {
	ExperiencePromptSearchView.prototype = Object.create(RootPanelSearchView.prototype);
	ExperiencePromptSearchView.prototype.constructor = ExperiencePromptSearchView;

	ExperiencePromptSearchView.prototype.searchPathType = 'experience prompt';
	ExperiencePromptSearchView.prototype.searchPathTextField = 'translation>text';
	
	/* Overrides SearchView.searchPath */
	ExperiencePromptSearchView.prototype.resultType = function()
	{
		return cr.ExperiencePrompt;
	}
	
	ExperiencePromptSearchView.prototype.controllerType = function()
	{
		return ExperiencePromptController;
	}
	
	ExperiencePromptSearchView.prototype.childPanelType = function()
	{
		return ExperiencePromptPanel;
	}
	
	function ExperiencePromptSearchView(sitePanel) {
		RootPanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return ExperiencePromptSearchView;
})();

var ExperiencePromptsPanel = (function () {
	ExperiencePromptsPanel.prototype = Object.create(RootItemsPanel.prototype);
	ExperiencePromptsPanel.prototype.constructor = ExperiencePromptsPanel;

	ExperiencePromptsPanel.prototype.panelTitle = crv.buttonTexts.experiencePrompts;
	ExperiencePromptsPanel.prototype.addPanelTitle = "Add Experience Prompt";
	ExperiencePromptsPanel.prototype.searchViewType = ExperiencePromptSearchView;
	
	function ExperiencePromptsPanel(onShow)
	{
		RootItemsPanel.call(this, this.panelTitle, onShow);
	}
	
	return ExperiencePromptsPanel;
	
})();

