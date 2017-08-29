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
		
		this.navContainer.appendTitle(header);

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
		return [{code: '', name: "(None)"},
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
	
	PickCanRegisterPanel.getDescription = function(storedValue)
	{
		var d = PickCanRegisterPanel.prototype.data.call(null).find(function(d)
			{
				return d.code == storedValue;
			})
		return d && d.name;
	}

	return PickCanRegisterPanel;
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
	
	function InquirySearchView(sitePanel, session) {
		ChildSearchView.call(this, sitePanel, session);
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
		setupOnViewEventHandler(this.parent, 'inquiryAdded.cr', panel.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
			}); 
		panel.showLeft().then(unblockClick);
	}
	
	function InquiriesPanel(parent, onShow) {
		ChildrenPanel.call(this, parent, onShow);
		this.createRoot(parent, crv.buttonTexts.inquiries, 'list', onShow);
	}
	
	return InquiriesPanel;
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
		setupOnViewEventHandler(this.parent, 'enrollmentAdded.cr', panel.node(), function(eventObject)
			{
				_this.searchView.restartSearchTimeout(_this.searchView.inputCompareText());
			}); 
		panel.showLeft().then(unblockClick);
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
	
	PickWeekdayPanel.getDescription = function(storedValue)
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
		ChildPanel.prototype.promiseUpdateChanges.call(this);
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
			user ? controller.newInstance().user().description() : "(None)");
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
	NewInquiryPanel.prototype = Object.create(crv.SitePanel.prototype);
	NewInquiryPanel.prototype.constructor = NewInquiryPanel;

	NewInquiryPanel.prototype.session = null;
	function NewInquiryPanel(session, title)
	{
		crv.SitePanel.call(this);
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
				cr.getData({path: this.session.urlPath() + "/enrollment[user={0}]".format(user.id()),
							resultType: cr.Enrollment,
							})
				  .then(function(enrollments)
						{
							try
							{
								var offering = _this.session.parent();
								console.assert(offering);
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
	NewEnrollmentPanel.prototype = Object.create(crv.SitePanel.prototype);
	NewEnrollmentPanel.prototype.constructor = NewEnrollmentPanel;

	NewEnrollmentPanel.prototype.session = null;
	function NewEnrollmentPanel(session, title)
	{
		crv.SitePanel.call(this);
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
	PickEngagementUserPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickEngagementUserPanel.prototype.constructor = PickEngagementUserPanel;

	PickEngagementUserPanel.prototype.session = null;

	function PickEngagementUserPanel(session, engagement, title)
	{
		crv.SitePanel.call(this);
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
		if (prepareClick('click', 'pick {0}: {1}'.format(this.pathType, d.description())))
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
		panel.showLeft().then(unblockClick);
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
		
		this.navContainer.appendTitle(header);
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
									valueFunction.call(container, newValue);
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

var OfferingPanel = (function () {
	OfferingPanel.prototype = Object.create(ChildPanel.prototype);
	OfferingPanel.prototype.constructor = OfferingPanel;

	OfferingPanel.prototype.deleteLabel = "Delete Offering";

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	OfferingPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
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
		this.namesSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit multiple', true);
		this.namesSection.append('label')
			.text(this.namesLabel);
		this.appendTranslationEditor(this.namesSection, controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
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
		this.tagPoolSection = new TagPoolSection(this, controller);
		this.tagPoolSection.section.classed('first', true);

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

		this.namesSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit multiple', true);
		this.namesSection.append('label')
			.text(this.namesLabel);
		this.appendTranslationEditor(this.namesSection, controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
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
		if (this.buttons().size() == 0)
		{
			var _this = this;
			var items = this.getDataChunker.appendButtonContainers([null]);
			items.on('click', function(d, i) {
				_this.onClickButton(d, i, this);
			})
			items.append("div")
				.classed("description-text growable", true)
				.text("(None)");
		}
		return SearchOptionsView.prototype.appendButtonContainers.call(this, foundObjects);
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
	
	function PickInquiryAccessGroupSearchView(sitePanel, organization) {
		this.organization = organization;
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

		var centerButton = this.navContainer.appendTitle(title);

		this.searchView = new PickInquiryAccessGroupSearchView(this, organization);
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
					inputBox.setSelectionRange(0, inputBox.value.length)
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
		
		this.navContainer.appendTitle(title);
		
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
		this.namesSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit multiple', true);
		this.namesSection.append('label')
			.text(this.namesLabel);
		this.appendTranslationEditor(this.namesSection, controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
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
		this.namesSection = this.mainDiv.append('section')
			.datum(controller.newInstance())
			.classed('cell edit multiple', true);
		this.namesSection.append('label')
			.text(this.namesLabel);
		this.appendTranslationEditor(this.namesSection, controller.newInstance(), crv.buttonTexts.names, crv.buttonTexts.name, 
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

		var publicAccessTextContainer = null;
		
		this.publicAccessSection = this.mainDiv.append('section')
			.classed('cell edit unique first', true)
			.datum(controller.newInstance())
			.on('click', 
				function(d) {
					if (prepareClick('click', 'pick ' + crv.buttonTexts.publicAccess))
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

	ExperiencePromptsPanel.prototype.panelTitle = "Experience Prompts";
	ExperiencePromptsPanel.prototype.addPanelTitle = "Add Experience Prompt";
	ExperiencePromptsPanel.prototype.searchViewType = ExperiencePromptSearchView;
	
	function ExperiencePromptsPanel(onShow)
	{
		RootItemsPanel.call(this, this.panelTitle, onShow);
	}
	
	return ExperiencePromptsPanel;
	
})();

