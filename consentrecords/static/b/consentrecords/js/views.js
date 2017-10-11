/*
	There are four types of panels:
		view_panel: Used to view the contents of an instance.
		edit_panel: Used to edit the contents of an instance.
		pick_panel: Used to pick an object from a list of objects. 
		 add_panel: Used to specify the contents of a new object. This is functionally the
					same as the edit_panel, with blank data.
					
	
 */

$.fn.animateRotate = function(startAngle, endAngle, duration, easing, complete) {
    var args = $.speed(duration, easing, complete);
    var step = args.step;
    return this.each(function(i, e) {
        args.complete = $.proxy(args.complete, e);
        args.step = function(now) {
            $.style(e, 'transform', 'rotate(' + now + 'deg)');
            if (step) return step.apply(e, arguments);
        };

        $({deg: startAngle}).animate({deg: endAngle}, args);
    });
};

$.fn.getFillHeight = function()
{
	var parent = this.parent();
	var n = this.get(0);
	var newHeight = parent.children().toArray().reduce(function(h, childNode) {
			var child = $(childNode);
			if (child.css('display') != 'none' && 
				child.css("position") != "absolute" &&
				childNode != n)
				return h - child.outerHeight(true);
			else
				return h;
		},
		parseInt(parent.height()));
	return newHeight;
}

/* A utility function for formatting strings like printf */
String.prototype.format = function () {
  var args = arguments;
  return this.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
    if (m == "{{") { return "{"; }
    if (m == "}}") { return "}"; }
    return args[n];
  });
};

RegExp.escape= function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

var crv = {
	/* Reference https://www.loc.gov/standards/iso639-2/php/code_list.php */
	defaultLanguageCode: 'en',
	languages: [{code: 'en', name: "English"}, 
			    {code: 'sp', name: "Spanish"},
			    {code: 'zh', name: "Chinese"}],
			    
	buttonTexts: {
		add: "Add",
		address: "Address",
		birthday: "Birthday",
		birthdayRequiredForPublicAccess:
			"Before sharing your path or asking others to share theirs, please specify at least the year and month of your birthday.",
		cancel: "Cancel",
		canRegister: "Can Register",
		changeEmail: "Change Email",
		changePassword: "Change Password",
		city: "City",
		cookiesRequired:
			"this operation requires cookies to be enabled. Please enable cookies for this browser and reload this page.",
		currentTimeframe: "Something I'm Doing Now",
		disqualifyingTags: "Disqualifying Tags",
		domain: "Domain",
		done: "Done",
		edit: "Edit",
		email: "Email",
		emailPublic: "By Request",
		emails: "Emails",
		end: "End",
		ended: "Ended",
		ends: "Ends",
		endTime: "End Time",
		enrollment: "Enrollment",
		enrollments: "Enrollments",
		engagement: "Engagement",
		engagements: "Engagements",
		experiencePrompt: "Experience Prompt",
		experiencePrompts: "Experience Prompts",
		firstName: "First Name",
		goalTimeframe: "My Goal",
		group: "Group",
		groups: "Groups",
		hidden: "Hidden",
		implications: "Implications",
		inquiry: "Inquiry",
		inquiries: "Inquiries",
		lastName: "Last Name",
		maximumAge: "Maximum Age",
		maximumGrade: "Maximum Grade",
		members: "Members",
		minimumAge: "Minimum Age",
		minimumGrade: "Minimum Grade",
		names: "Names",
		name: "Name",
		no: "No",
		nonePlaceholder: "(None)",
		noPublicAccess: "Hidden",
		nullString: "(None)",
		offering: "Offering", 
		offeringLabel: "Offering Label",
		offeringLabels: "Offering Labels",
		offerings: "Offerings", 
		organization: "Organization",
		organizationLabel: "Organization Label",
		organizationLabels: "Organization Labels",
		organizations: "Organizations",
		pathPublic: "Public Path Only",
		period: "Period",
		periods: "Periods",
		pickOffering: "Pick Offering",
		pickOrganization: "Pick Organization",
		pickService: "Pick Tag",
		pickSite: "Pick Site",
		previousTimeframe: "Done",
		primaryAdministrator: "Primary Administrator",
		publicAccess: "Public Access",
		readPublicAccess: "Public",
		registerByDate: "register by {0}",
		registrationDeadline: "Registration Deadline",
		screenName: "Screen Name",
		search: "Search",
		service: "Service",
		services: "Services",
		session: "Session",
		sessions: "Sessions",
		settings: "Settings",
		site: "Site",
		siteLabel: "Site Label",
		siteLabels: "Site Labels",
		sites: "Sites",
		stage: "Stage",
		start: "Start",
		started: "Started",
		starts: "Starts",
		startTime: "Start Time",
		state: "State",
		street: "Street",
		streets: "Streets",
		tags: "Tags",
		text: "Text",
		texts: "Texts",
		timeframe: "Timeframe",
		user: "User",
		userPublic: "Public Profile and Path",
		users: "Users",
		webSite: "Web Site",
		weekday: "Weekday",
		yes: "Yes",
		zipCode: "Zip Code",
	},

	appendLoadingMessage: function(node)
	{
		var div = d3.select(node).append('div').classed('loading', true);
		var parent = div.append('span');
		var child = parent.append('span');
		div.append('span')
			.classed("help-block", true)
			.text("Loading...");
		var opts = {
		  lines: 13 // The number of lines to draw
		, length: 4 // The length of each line
		, width: 2 // The line thickness
		, radius: 5 // The radius of the inner circle
		, scale: 1 // Scales overall size of the spinner
		, corners: 1 // Corner roundness (0..1)
		, color: '#000' // #rgb or #rrggbb or array of colors
		, opacity: 0.25 // Opacity of the lines
		, rotate: 0 // The rotation offset
		, direction: 1 // 1: clockwise, -1: counterclockwise
		, speed: 1 // Rounds per second
		, trail: 60 // Afterglow percentage
		, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
		, zIndex: 2e9 // The z-index (defaults to 2000000000)
		, className: 'spinner' // The CSS class to assign to the spinner
		, top: '15px' // Top position relative to parent
		, left: '16px' // Left position relative to parent
		, shadow: false // Whether to render a shadow
		, hwaccel: false // Whether to use hardware acceleration
		, position: 'relative' // Element positioning
		}
		var spinner = new Spinner(opts).spin(child.node());
		div.datum(spinner);
		return div;
	},
	
	startLoadingMessage: function(div)
	{
		var spinner = div.datum();
		spinner.spin(div.selectAll('span:first-child').node());
	},

	stopLoadingMessage: function(div)
	{
		var spinner = div.datum();
		spinner.stop();
	},
};

var clickBlockCount = 0;

/* Add a function to the bootstrap_alert to ensure that the user can respond to
	events before an alert is closed.
 */
bootstrap_alert.canClose = function()
	{
		return clickBlockCount == 0;
	};

/* Determines whether clicks should be blocked on the page.
	This is used to prevent extra clicks on buttons from repeating operations.
 */
function _isClickBlocked()
{
	return clickBlockCount;
}

/* Blocks clicks on the page. */			
function _blockClick()
{
	if (clickBlockCount > 0)
		throw new Error("Click over blocked");
	clickBlockCount += 1;
}

/* Unblocks clicks on the page. */			
function unblockClick()
{
	if (clickBlockCount === 0)
		throw new Error("Click unblocked.");
	clickBlockCount -= 1;
	if (clickBlockCount == 0 && 
		bootstrap_alert.timeout == null && 
		bootstrap_alert.closeOnTimeout)
		bootstrap_alert.close();
}

function prepareClick(name, message)
{
	if (_isClickBlocked())
	{
		if (name)
			cr.logRecord(name + ' blocked', message);
		return false;
	}
		
	_blockClick();
	if (name)
		cr.logRecord(name, message);
	return true;
}
 
function showClickFeedback(obj, done)
{
	var oldOpacity = $(obj).css("opacity");
	$(obj).animate({opacity: done ? "0.0" : "0.2"}, 200,
				function()
				{
					if (done)
						done();
				})
		   .animate({opacity: oldOpacity}, 600, "swing",
		   	function() {
		   		$(obj).css("opacity", "");
		   	});
}

function _pushTextChanged(d) {
	var f = function(eventObject) {
		d3.select(eventObject.data).text(this.description());
	}
	
	setupOnViewEventHandler(d, "changed.cr", this, f);
	
	if (d.cell && d.cell.isUnique())
	{
		setupOnViewEventHandler(d, "valueDeleted.cr", this, f);
	}
}

function _getDataDescription(d) { return d.description() }

function checkItemsDisplay(node)
{
	var classList = node.parentNode.classList;
	var isUnique = classList.contains('unique');
	var isEdit = classList.contains('edit');
	
	var itemsDiv = d3.select(node);
	var items = itemsDiv.selectAll('li');
	
	var isVisible;
	
	if (isEdit)
		isVisible = true;
	else
	{
		isVisible = false;
		items.each(function(d)
		{
			isVisible |= $(this).css('display') != 'none';
		});
	}
		
	itemsDiv.style('display', (isUnique || isVisible) ? null : 'none');
	/* In addition to the itemsDiv, hide the section if we are in view mode. */
	d3.select(node.parentNode).style('display', (isEdit || isVisible) ? null : 'none');
}

function setupOnViewEventHandler(source, events, data, handler)
{
	/* Make sure that there is a source before adding event handlers. */
	if (!source)
		return;
	if (typeof(source) != "object")
		throw new Error("source is not an object");
		
	source.on(events, data, handler);
	$(data).on("clearTriggers.cr remove", null, source, function(eventObject)
	{
		eventObject.data.off(events, handler);
	});
}

function setupOneViewEventHandler(source, events, data, handler)
{
	/* Make sure that there is a source before adding event handlers. */
	if (!source)
		return;
	if (typeof(source) != "object")
		throw new Error("source is not an object");
		
	source.one(events, data, handler);
	$(data).on("clearTriggers.cr remove", null, source, function(eventObject)
	{
		eventObject.data.off(events, handler);
	});
}

function hideItem(itemNode, done)
{
	$(itemNode).animate({height: "0px"}, 400, 'swing', function()
	{
		var parentNode = this.parentNode;
		$(this).css('display', 'none');
		
		/* Now that the item is removed, check whether its container should be visible. */
		checkItemsDisplay(parentNode);
		if (done) done();
	});
}

function removeItem(itemNode, done)
{
	$(itemNode).animate({height: "0px"}, 400, 'swing', function()
	{
		var parentNode = this.parentNode;
		$(this).remove();
		/* Now that the item is removed, check whether its container should be visible. */
		checkItemsDisplay(parentNode);
		if (done) done();
	});
}

function _setupItemHandlers(d, done)
{
	if ($(this).parents(".multiple").length > 0)
	{
		var f = function(eventObject)
		{
			removeItem(eventObject.data, done);
		}
		setupOneViewEventHandler(d, "deleted.cr", this, f);
	}
}

function editUniqueString(sectionObj, container, placeholder, value, inputType)
{
	var itemsDiv = crf.appendItemList(sectionObj);
	var items = itemsDiv.append('li');

	items.append("input")
		.classed('growable', true)
		.attr("type", inputType)
		.attr("placeholder", placeholder)
		.property("value", value);
}

/* Produces a function which adds new value view to a container view
	when the new data is added.
 */
function getOnValueAddedFunction(canDelete, canShowDetails, onClick)
{
	return function(eventObject, newValue)
	{
		var cell = this;
		var itemsDiv = d3.select(eventObject.data);
		
		var headerText = $(eventObject.data).parents(".site-panel").attr('headerText');
		var item = appendItem(itemsDiv, newValue);
		checkItemsDisplay(eventObject.data);
	
		/* Hide the new item if it is blank, and then show it if the data changes. */
		item.style('display', 
				   (cell.isUnique() || !newValue.isEmpty()) ? null : 'none');
			   
		if (!cell.isUnique())
		{
			function checkVisible(eventObject)
			{
				d3.select(eventObject.data).style('display', 
					   !this.isEmpty() ? null : 'none');
			}
			setupOnViewEventHandler(newValue, "changed.cr", item.node(), checkVisible);
		}

		item.on("click", function(d) {
			if (prepareClick('click', 'view added item: ' + d.description()))
			{
				try
				{
					onClick(cell, d, headerText, revealPanelLeft);
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
		});
		
		if (canDelete && !cell.isUnique())
			crf.appendDeleteControls(item);

		appendButtonDescriptions(item)
			.each(_pushTextChanged);
			
		if (canShowDetails)
			crf.appendRightChevrons(item);

		if (canDelete && !cell.isUnique())
		{
			crf.appendConfirmDeleteControls(item);
			var dials = $(item.node()).find('button:first-of-type');
			crf.showDeleteControls(dials, 0);
		}
	
		/* Return the item in case a calling function needs to do more. */
		return item;
	}
}

function appendRowButtons(divs)
{
	if (divs.empty())
		return divs.append("div");
	else
		return divs.append("div")
				.classed("btn row-button", $(divs.node()).parents(".unique").length === 0);
}

var crf = {
	buttonNames: {
		delete: "Delete"
	},
	
	appendItemList: function(container)
	{
		return container.append('ol')
			.classed('cell-items', true);
	},
	
	appendDeleteControls: function(containers)
	{
		$(containers.node()).parents('.panel-fill').on('resize.cr', 
			function(eventObject)
			{
				containers.each(function(e)
					{
						var oldLeft = parseInt($(this).css('left'));
						var newWidth = $(this).parent().innerWidth() - oldLeft;
						var $button = $(this).children('button:last-of-type')
						if ($button[0] != document.activeElement)
							newWidth += $button.outerWidth();
						$(this).innerWidth(newWidth);
					});
			});
			
		containers.each(function(e)
			{
				$(this).on('resize.cr', function(eventObject)
					{
						eventObject.stopPropagation();
					});
			});

		var buttons = containers.append('button')
			.classed('delete', true)
			.on("click", function(e)
			{
				if ($(this).css("opacity") > 0 &&
					prepareClick('click', 'delete button'))
				{
					var $this = $(this);
					var $button = $this.parent().children('button:last-of-type');
					
					$this.parent().stop();
					$button.css('opacity', 1);
					$this.children('div').animateRotate(90, 180, 600, 'swing');
					$this.parent().animate({'width': $this.parent().parent().innerWidth()},
											 {duration: 600,
											  easing: 'swing',
											  done: function () 
												{ 
													unblockClick(); 
													$button.focus();
												}});
				};
				d3.event.preventDefault();
			});
		buttons.append('div')
			.classed("glyphicon glyphicon-minus-sign", true);
			
		return buttons;
	},
	
	appendConfirmDeleteControls: function(items, onClick)
	{
		onClick = (onClick !== undefined ? onClick :
			function(d)
			{
				/* Test case: Delete an existing value in a cell that has multiple values. */
				if (prepareClick('click', 'confirm delete: ' + d.description()))
				{
					try {
						d.deleteData()
							.then(unblockClick, cr.syncFail);
					} catch(err) { cr.syncFail(err); }
				}
			});
		
		items.classed("flex-deletable", true);						
	
		return items.append("button")
			.text(crf.buttonNames.delete)
			.style('opacity', 0)
			.on('blur', function(e)
			{
				var deleteButton = $(this.parentNode).find("button:first-of-type");
				deleteButton.children('div').animateRotate(180, 90, 400);

				var confirmButtons = $(this);
				var rightHiddenWidth = confirmButtons.outerWidth();
				var newWidth = confirmButtons.parent().parent().innerWidth() + 
							   rightHiddenWidth;
				confirmButtons.parent().animate({'width': newWidth},
										 {duration: 400,
										  easing: 'swing'})
								.promise()
								.done(function()
									{
										confirmButtons.css('opacity', 0);
									});
			})
			.on('click', onClick);
	},

	/**
		Appends a right-pointing chevron to the specified containers that appears inline.
	 */
	appendRightChevrons: function(items)
	{
		return items
			.append("img")
			.classed("site-chevron-right", true)
			.attr("src", rightChevronPath)
			.attr("height", "18px");
	},
	
	showDeleteControls: function(dials, duration)
	{
		duration = duration !== undefined ? duration : 400;
		
		dials.animate({opacity: 1}, duration);
		
		var confirmButtons = dials.parent().children('button:last-of-type');
		
		/* Calculate the widths after a timeout so that metrics are guaranteed to be correct. */
		setTimeout(function()
			{
				var rightHiddenWidth = confirmButtons.outerWidth();
				var newWidth = dials.parent().parent().innerWidth() + 
							   rightHiddenWidth;
				dials.parent().animate({left: "0px", width: newWidth}, {duration:duration});
			});
	},
	
	hideDeleteControls: function(dials, duration)
	{
		duration = duration !== undefined ? duration : 400;
		
		/* Extend each item by the width of its delete control visible content and
			its delete control left padding.
			
			dials.width() may not be retrievable if the underlying image isn't loaded.
			In this case, default to 14.
		 */
		 
		var dialWidth = dials.width() || 14;
		var newLeft = dialWidth + parseInt(dials.css('padding-left'));
		
		/* Extend each item by the width of its confirm delete button. */
		var confirmButtons = dials.parent().children('button:last-of-type');
		var rightHiddenWidth = confirmButtons.outerWidth();
		var newWidth = newLeft + 
					   dials.parent().parent().innerWidth() + 
					   rightHiddenWidth;
		dials.parent().animate({left: -newLeft, width: newWidth}, duration);
		dials.animate({opacity: 0}, duration);
	}
}

function appendLeftChevrons(buttons)
{
	return buttons.append("div")
		.classed("site-left-chevron-span", true)
		.append("img")
		.classed("site-left-chevron", true)
		.attr("src", leftChevronPath);
}

function appendLeftChevronSVG(container)
{
	var svg = container.append('svg')
		.attr('xmlns', "http://www.w3.org/2000/svg")
		.attr('version', "1.1")
		.attr('viewBox', '160 96 192 320')
		.attr('preserveAspectRatio', 'none');
	svg.append('polygon')
		.attr('points', "352,128.4 319.7,96 160,256 160,256 160,256 319.7,416 352,383.6 224.7,256 ");
	return svg;
}

function appendRightChevronSVG(container)
{
	var svg = container.append('svg')
		.attr('xmlns', "http://www.w3.org/2000/svg")
		.attr('version', "1.1")
		.attr('viewBox', '0 96 192 320')
		.attr('preserveAspectRatio', 'none');
	svg.append('polygon')
		.attr('points', "0,128.4 32.3,96 192,256 192,256 192,256 32.3,416 0,383.6 127.3,256");
	return svg;
}

/* This function appends the descriptions of each object to the button. */
function appendButtonDescriptions(buttons)
{
	return buttons.append("div")
		.classed("description-text growable", true)
		.text(_getDataDescription);
}

/**
	Append a div containing a description of the data element associated with each item.
 */
function appendDescriptions(items)
{
	return items.append("div")
		.classed("description-text growable", true)
		.text(_getDataDescription)
		.each(_pushTextChanged);
}

function appendButtons(panel2Div, rootObjects, buttonClicked, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;
	
	var section = panel2Div.append("section")
		.classed("cell multiple", true);
	
	var itemsDiv = crf.appendItemList(section)
		.classed('hover-items', true);

	var items = itemsDiv.selectAll("li")
				.data(rootObjects)
				.enter()
				.append("li");

	return appendViewButtons(items, fill)
		.on("click", buttonClicked);
}

/* Adds the contents of the specified items. By default, 
	the contents consist of the text for each item. */
function appendViewButtons(items, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;

	fill(items);
		
	return items;
}

function appendItems(container, data, doneDelete)
{
	var i = 0;
	return container.selectAll("li")
		.data(data, function(d) {
			/* Ensure that this operation appends without replacing any items. */
			i += 1;
			return i;
		  })
		.enter()
		.append("li")	// So that each button appears on its own row.
		.each(function(d) { _setupItemHandlers.call(this, d, doneDelete); });
}

function appendItem(container, d)
{
	return container
		.append("li")	// So that each button appears on its own row.
		.datum(d)
		.each(_setupItemHandlers);
}

/* Returns the set of objects that contain the description of each data element */
function appendViewCellItems(container, cell, clickFunction)
{
	// Remove any lingering contents.
	container.selectAll("li").remove();

	var items = appendItems(container, cell.data);
	
	appendDescriptions(items);
		
	crf.appendRightChevrons(items);

	items.on("click", clickFunction);
	
	return items;
}

/* Returns the set of objects that contain the description of each data element */
function appendEditCellItems(itemsDiv, cell, clickFunction)
{
	// Remove any lingering contents.
	itemsDiv.selectAll("li").remove();

	var items = appendItems(itemsDiv, cell.data);
	
	if (!cell.isUnique())
		crf.appendDeleteControls(items);

	appendButtonDescriptions(items)
		.each(_pushTextChanged);
		
	items.on("click", clickFunction);
	
	crf.appendRightChevrons(items);

	if (!cell.isUnique())
	{
		crf.appendConfirmDeleteControls(items);
		var dials = $(itemsDiv.node()).find('li>button:first-of-type');
		crf.showDeleteControls(dials, 0);
	}
	
	return items;
}

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 * 
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 * 
 * @see http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
function getTextWidth(text, font) {
    // re-use canvas object for better performance
    var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
};

/* A SiteNavContainer is a view for the navigation bar that appears at the top of a site panel. 
 */
var SiteNavContainer = (function() {
	SiteNavContainer.prototype.nav = undefined;
	SiteNavContainer.prototype.div = undefined;
	
	SiteNavContainer.prototype.appendButton = function()
	{
		return this.div.append("div").classed("site-navbar-link site-active-text", true);
	}
	
	SiteNavContainer.prototype.appendLeftButton = function()
	{
		return this.div.append("div").classed("left-link site-navbar-link site-active-text", true);
	}
	
	SiteNavContainer.prototype.appendRightButton = function()
	{
		var firstChild = this.div.selectAll('div.right-link');
		var rightChild;
		if (firstChild.empty())
			rightChild = this.div.append('div');
		else
			rightChild = this.div.insert('div', 'div.right-link');
			
		return rightChild.classed('right-link site-navbar-link site-active-text', true);
	}
	
	SiteNavContainer.prototype.setTitle = function(title)
	{
		var h = this.div.selectAll('div.site-title');
		h.text(title);
		this.sitePanel.headerText = title;
	}
	
	SiteNavContainer.prototype.appendTitle = function(newTitle)
	{
		var h = this.div.append('div').classed('site-title', true);
		this.setTitle(newTitle);
		
		var _this = this;
		var f = function()
			{
				var leftWidth = 0, rightWidth = 0;
				_this.div.selectAll('.left-link').each(function(d)
					{
						leftWidth += $(this).outerWidth();
					});
				_this.div.selectAll('.right-link').each(function(d)
					{
						rightWidth += $(this).outerWidth();
					});
				h.style('padding-right', '0px')
					 .style('padding-left', '0px');
				var padding = newTitle ? ($(h.node()).innerWidth() - (getTextWidth(newTitle, h.style("font"))+1)) : 0;
				if (padding <= 0)
				{
					h.style('padding-right', '0px')
					 .style('padding-left', '0px');
				}
				else if (leftWidth > rightWidth)
				{
					if (leftWidth - rightWidth < padding)
						padding = leftWidth - rightWidth;
					h.style('padding-right', '{0}px'.format(padding))
					 .style('padding-left', '0px');
				}
				else
				{
					if (rightWidth - leftWidth < padding)
						padding = rightWidth - leftWidth;
					h.style('padding-left', '{0}px'.format(padding))
					 .style('padding-right', '0px');
				}
			};
			
		$(this.sitePanel.node()).on('revealing.cr', f);
		$(window).resize(f);
		$(this.div.node()).on('remove', function()
			{
				$(window).off('resize', f);
			});
		
		return h;
	}
	
	function SiteNavContainer(sitePanel)
	{
		this.sitePanel = sitePanel;
		this.nav = sitePanel.panelDiv.append("nav")
					.attr("role", "navigation")
		this.div = this.nav.append('div');
	}
	
	return SiteNavContainer;
})();

/* Creates a panel that sits atop the specified containerPanel in the same container. */
crv.SitePanel = (function () {
	SitePanel.prototype.panelDiv = undefined;
	SitePanel.prototype.navContainer = undefined;
	SitePanel.prototype.panel2Div = undefined;
	SitePanel.prototype.headerText = null;
	SitePanel.prototype.hide = null;
	
	function SitePanel() {
	}
	
	SitePanel.prototype.createRoot = function(datum, headerText, panelClass, showFunction) {
		var rootPanel = d3.select("body");
		
		/* Set the top & left so that the panel appears below the screen during its setup.
			The height must be set explicitly to work around problems that appear in iOS 7 under
			certain conditions. 
		 */
		this.panelDiv = rootPanel
						.append("panel")
						.classed("site-panel", true)
						.datum(datum)
						.attr("headerText", headerText)
						.style('top', "{0}px".format($(window).innerHeight()))
						.style('height', "{0}px".format($(window).innerHeight()))
						.style('left', "{0}px".format(0));
		this.node().sitePanel = this;
						
		if (panelClass && panelClass.length > 0)
			this.panelDiv.classed(panelClass, true);
			
		this.headerText = headerText;
		var _this = this;
		if (showFunction === revealPanelUp)
		{
			this.hide = function()
				{
					return _this.hideDown()
						.then(unblockClick);
				};
		}
		else
		{
			this.hide = function()
				{
					return _this.hideRight()
						.then(unblockClick);
				};
		}
	}
    
    SitePanel.prototype.node = function()
    {
    	return this.panelDiv.node();
    }
    
    SitePanel.prototype.appendNavContainer = function()
    {
		return new SiteNavContainer(this);
    }
    
    SitePanel.prototype.appendBottomNavContainer = function()
    {
    	var n = new SiteNavContainer(this);
    	n.nav.classed("bottom", true);
    	return n;
    }
	
	SitePanel.prototype.appendBackButton = function()
	{
		var _this = this;
		var backButton = this.navContainer.appendLeftButton()
			.on('click', function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					try {
						_this.hide();
					} catch(err) { cr.syncFail(err); }
				}
				d3.event.preventDefault();
			});
		backButton.append('span').text(crv.buttonTexts.cancel);
	}
	
	SitePanel.prototype.appendSearchBar = function(textChanged)
	{
		var searchBar = this.panelDiv.append("div").classed("searchbar", true);
	
		var searchCancelButton = searchBar.append("span")
			.classed("search-cancel-button site-active-text", true);
		searchCancelButton.append('span').text(crv.buttonTexts.cancel);
	
		var searchCancelButtonWidth = 0;
		var oldPaddingLeft = searchCancelButton.style("padding-left");
		var oldPaddingRight = searchCancelButton.style("padding-right");
		$(searchCancelButton.node())
			.css("padding-left", "0")
			.css("padding-right", "0");
	
		var searchInputContainer = searchBar.append("div")
			.classed("search-input-container", true);
		
		var searchInput = searchInputContainer
			.append("input")
			.classed("search-input", true)
			.attr("placeholder", "Search");
	
		var lastText = "";	
		$(searchInput.node()).on("keyup input paste", function(e) {
				if (lastText != this.value)
				{
					lastText = this.value;
					textChanged.call(this);
				}
			})
			.on("focusin", function(e)
			{
				searchCancelButton.selectAll('span').text(crv.buttonTexts.cancel);
				$(searchCancelButton.node()).animate({width: searchCancelButtonWidth,
													  "padding-left": oldPaddingLeft,
													  "padding-right": oldPaddingRight}, 400, "swing");
			})
			.on('focusout', function(e)
			{
				if (searchInput.node().value.length == 0)
					$(searchCancelButton.node()).animate({width: 0,
														  "padding-left": 0,
														  "padding-right": 0}, 400, "swing",
														  function() {
															searchCancelButton.selectAll('span').text(null);
														  });
			});
	
		$(searchCancelButton.node()).on("click", function(e) {
			searchInput.node().value = "";
			$(searchInput.node()).trigger("input");
			$(this).animate({width: 0,
							  "padding-left": 0,
							  "padding-right": 0}, 400, "swing",
							  function() {
								searchCancelButton.selectAll('span').text(null);
							  });
		});
	
		function resizeSearchCancelHeight()
		{
			/* Trigger the resize in the next event to ensure that css widths and
				heights have been applied.
			 */
			setTimeout(function()
				{
					/* Calculate the width of the cancel button. */	
					if (searchCancelButtonWidth == 0 &&
						$(searchCancelButton.node()).width() > 0)
					{
						var cancelBoundingRect = searchCancelButton.node().getBoundingClientRect();
						var h = searchInputContainer.node().getBoundingClientRect().height
							- cancelBoundingRect.height
							+ parseInt(searchCancelButton.style("padding-top"))
							+ parseInt(searchCancelButton.style("padding-bottom"));
						searchCancelButton.style("padding-top",(h/2).toString()+"px")
							.style("padding-bottom", (h/2).toString()+"px");
		
						var oldWidth = searchCancelButton.style("width");
						searchCancelButton.style("width", null);
						searchCancelButtonWidth = $(searchCancelButton.node()).width() + 
												  parseInt(oldPaddingRight) +
												  parseInt(oldPaddingLeft);
						$(searchCancelButton.node()).outerWidth(0);
						searchCancelButton.select('span').text(null);
					}
				}, 0);
		}
	
		$(this.node()).one("revealing.cr", resizeSearchCancelHeight);
	
		return searchInput.node();
	}
	
	SitePanel.prototype.appendFillArea = function()
	{
		var _this = this;
		this.panelDiv.append('div').classed('alert-container', true);
		var panel2Div = this.panelDiv
			.append("div").classed("body", true)
			.append("div")
			.append("div").classed("panel-fill", true)
			.style("overflow-y", "hidden");
			
		return panel2Div;
	}
	
	SitePanel.prototype.scrollAreaHeight = function()
	{
		return parseInt(this.mainDiv.style("height"));
	}
	
	SitePanel.prototype.scrollAreaWidth = function()
	{
		return parseInt(this.mainDiv.style("width"));
	}
	
	SitePanel.prototype.calculateHeight = function()
	{
		if (this.mainDiv)
		{
			var mainNode = $(this.mainDiv.node());
			mainNode.css('height', "{0}px".format(mainNode.getFillHeight()))
				.one("resize.cr", function(eventObject)
				{
					eventObject.stopPropagation();
				});
			
			/* Since calculateHeight is first called within revealing.cr, 
				resize handlers should be set up in subsequent revealing.cr handlers.
			 */	
			mainNode.trigger("resize.cr");
		}
	}
	
	SitePanel.prototype.appendScrollArea = function()
	{
		var _this = this;
		this.mainDiv = this.panelDiv
			.append("div").classed("panel-fill vertical-scrolling", true);
		
		$(this.node()).on("revealing.cr", function()
			{
				_this.calculateHeight();
			});
		
		this.mainDiv.appendHeader = function()
		{
			return this.append("header")
				.text(_this.headerText);
		}
		
		this.mainDiv.appendSections = function(sectionData)
		{
			var i = 0;
			return this
					.selectAll("section")
					.data(sectionData, 
						  function(d) {
						  	/* Ensure that this operation appends without replacing any items. */
						  	i += 1;
						  	return i;
						  })
					.enter()
					.append("section");
		}
		return this.mainDiv;
	}
	
	SitePanel.prototype.appendActionButton = function(text, onClick)
	{
		var sectionDiv = this.mainDiv.append('section')
			.classed('cell unique action', true)
			.on('click', onClick);
		var itemsDiv = crf.appendItemList(sectionDiv)
			.classed('hover-items', true);
		
		var item = itemsDiv.append('li');
			
		item.append('div')
			.classed("text-fill site-active-text growable unselectable", true)
			.text(text);
				
		return sectionDiv;	
	}
	
	SitePanel.prototype.datum = function()
	{
		return this.panelDiv.datum();
	}
	
	SitePanel.prototype.showNow = function()
	{
		var $panelNode = $(this.node());
		$panelNode.offset({top: 0, left: 0})
				.trigger("revealing.cr");
	}
	
	SitePanel.prototype.showUp = function()
	{
		var $panelNode = $(this.node());
		window.scrollTo(0, 0);
		
		$panelNode.trigger("revealing.cr");
		return $panelNode.animate({'top': 0})
			.promise();
	}
	
	SitePanel.prototype.showLeft = function()
	{
		var _this = this;
		var $panelNode = $(this.node());

		window.scrollTo(0, 0);
		$panelNode.css({top: 0,
						left: "{0}px".format(window.innerWidth)});
		$panelNode.trigger("revealing.cr");
		return $panelNode.animate({left: 0})
			.promise();
	}

	SitePanel.prototype.hideDown = function(done)
	{
		bootstrap_alert.close();
		$(this.node()).trigger("hiding.cr");
		return $(this.node()).animate({'top': "{0}px".format(window.innerHeight)})
			.promise()
			.done(function() {
				$(this).remove();
				if (done)
					done();
			});
	}
	
	SitePanel.prototype.handleCloseDownEvent = function()
	{
		if (!_isClickBlocked())
		{
			cr.logRecord('click', 'Close Down');
			_blockClick();
			this.hideDown(unblockClick);
		}
		else
			cr.logRecord('click', 'Close Down blocked');
			
	}
	
	SitePanel.prototype.hideRight = function(done)
	{
		bootstrap_alert.close();
		return $(this.node()).trigger("hiding.cr")
			.animate({left: "{0}px".format(window.innerWidth)})
			.promise()
			.done(function()
				{
					$(this).remove();
					if (done)
						done();
				});
	}
	
	SitePanel.prototype.hideNow = function()
	{
		$(this.node()).trigger("hiding.cr")
					  .remove();
	}
	
	SitePanel.prototype.hideRightEvent = function()
	{
		if (prepareClick('click', 'Close Right'))
		{
			try {
				this.hideRight().then(unblockClick);
			} catch(err) { cr.syncFail(err); }
		}
		else
			cr.logRecord('click', 'Close Right blocked');
		d3.event.preventDefault();
	}
	
	$(window).resize(function()
		{
			$(".site-panel").css('height', "{0}px".format($(window).innerHeight()))
				.each(function()
				{
					this.sitePanel.calculateHeight();
				});
		});
	return SitePanel;
})();

/* A view that displays the results of a search as a list of results.
	The list appears in a list element.
   Each result appears in an li element.
 */
var SearchOptionsView = (function () {
	SearchOptionsView.prototype.listElement = null;
	SearchOptionsView.prototype.getDataChunker = null;
	SearchOptionsView.prototype._foundCompareText = null;
	SearchOptionsView.prototype._constrainCompareText = null;
	SearchOptionsView.prototype._searchTimeout = null;

	/* containerNode is the node that contains the noResults Div and the list 
		containing the results.
	 */
	function SearchOptionsView(containerNode, chunkerType)
	{
		if (containerNode)
		{
			var _this = this;
			
			this.noResultsDiv = d3.select(containerNode).append('div')
				.classed('no-results', true)
				.style('display', 'none');

			this.listElement = this.appendSearchArea();

			var done = function(foundObjects, startVal)
			{
				var currentVal = _this.inputCompareText();
				if (currentVal == startVal ||
					_this.canConstrain(startVal, currentVal))
				{
					_this.showObjects(foundObjects);
					_this.checkNoResults();
					return true;
				}
				else
					return false;
			}
			chunkerType = chunkerType !== undefined ? chunkerType : GetDataChunker;
			this.getDataChunker = new chunkerType(this.listElement.node(), done);
		}
	}
	
	SearchOptionsView.prototype.buttons = function()
	{
		return this.listElement.selectAll('li');
	}
	
	SearchOptionsView.prototype.checkNoResults = function()
	{
		var text = this.noResultString();
		this.noResultsDiv.text(text);
		this.noResultsDiv.style('display', (this.getDataChunker.hasButtons() || text.length === 0) ? 'none' : null);
	}
	
	SearchOptionsView.prototype.onClickButton = function(d, i) {
		throw new Error("need to override SearchOptionsView.onClick");
	}
	
	SearchOptionsView.prototype.isButtonVisible = function(button, d, compareText)
	{
		throw new Error("need to override SearchOptionsView.isButtonVisible");
	}
	
	SearchOptionsView.prototype.searchPath = function(val)
	{
		throw new Error("need to override SearchOptionsView.searchPath");
	}
	
	SearchOptionsView.prototype.appendButtonContainers = function(foundObjects)
	{
		return this.getDataChunker.appendButtonContainers(foundObjects);
	}
	
	SearchOptionsView.prototype.clearListPanel = function()
	{
		this.listElement.selectAll("li").remove();
	}
	
	SearchOptionsView.prototype.sortFoundObjects = function(foundObjects)
	{
		function sortByDescription(a, b)
		{
			return a.description().localeCompare(b.description());
		}
		foundObjects.sort(sortByDescription);
	}
	
	SearchOptionsView.prototype.setConstrainText = function(val)
	{
		this._constrainCompareText = val;
	}
	
	SearchOptionsView.prototype.constrainFoundObjects = function()
	{
		var buttons = this.listElement.selectAll("li");
		var _this = this;
		buttons.style('display', function(d) 
			{ 
				if (_this.isButtonVisible(this, d, _this._constrainCompareText))
					return null;
				else
					return 'none';
			});
	}
	
	SearchOptionsView.prototype.fillItems = function(items)
	{
		appendDescriptions(items)
			.classed('unselectable', true);
	}
	
	/* Show the objects that have been found. In this implementation, the objects appear as a list of buttons. */
	SearchOptionsView.prototype.showObjects = function(foundObjects)
	{
		var _this = this;
		var items = this.appendButtonContainers(foundObjects)
			.on('click', function(d, i) {
				_this.onClickButton(d, i, this);
			});
			
		this.fillItems(items);

		this.constrainFoundObjects();
		return items;
	}
	
	/* Overwrite this function to use a different set of fields for the getData or selectAll operation
		sent to the middle tier.
	 */
	SearchOptionsView.prototype.fields = function()
	{
		return ["parents"];
	}
	
	SearchOptionsView.prototype.increment = function()
	{
		return 20;
	}
	
	SearchOptionsView.prototype.noResultString = function()
	{
		return "No Results";
	}
	
	/*
		Do all of the user interface tasks that indicate that a search to the database can't retrieve any values.
	 */
	SearchOptionsView.prototype.cancelSearch = function()
	{
		this.clearListPanel();
		this.getDataChunker.clearLoadingMessage();
	}
	
	SearchOptionsView.prototype.setupChunkerArguments = function(compareText)
	{
		this.getDataChunker.path = this.searchPath(compareText);
		if (this.getDataChunker.path)
		{
			this.getDataChunker.fields = this.fields(compareText);
			this.getDataChunker.resultType = this.resultType(compareText);
			this.getDataChunker.increment(this.increment());
		}
	}
	
	SearchOptionsView.prototype.search = function(val)
	{
		if (val !== undefined)
		{
			this._foundCompareText = val;
			this._constrainCompareText = val;
		}
		
		this.setupChunkerArguments(this._constrainCompareText);
		if (this.getDataChunker.path)
			this.getDataChunker.start(this._constrainCompareText);			
		else
			this.cancelSearch();
	}
	
	SearchOptionsView.prototype.inputText = function(val)
	{
		throw new Error("need to override SearchOptionsView.inputText");
	}
	
	SearchOptionsView.prototype.inputCompareText = function()
	{
		return this.inputText().toLocaleLowerCase();
	}
	
	// Begin a timeout that, when it is done, begins a search.
	// This gives the user time to update the search text without 
	// doing a search for each change to the search text.
	SearchOptionsView.prototype.startSearchTimeout = function(val, pauseDuration)
	{
		pauseDuration = pauseDuration !== undefined ? pauseDuration : 300;
		this.clearListPanel();
		if (this.searchPath(val))
			this.getDataChunker.showLoadingMessage();
		else
			this.getDataChunker.clearLoadingMessage();
				
		/* Once we have hit this point, old data is not valid. */
		this._foundCompareText = null;
		this.getDataChunker.invalidatePendingData();

		var _this = this;
		function endSearchTimeout() {
			_this._searchTimeout = null;
			try
			{
				_this.search(val);
			}
			catch(err)
			{
				asyncFailFunction(err);
			}
		}
		if (pauseDuration == 0)
			endSearchTimeout();
		else
			this._searchTimeout = setTimeout(endSearchTimeout, pauseDuration);
	}
	
	SearchOptionsView.prototype.textCleared = function()
	{
		this.clearListPanel();
		this.getDataChunker.clearLoadingMessage();
		this._foundCompareText = null;
	}
	
	/* Given a change in the text, see if the new constrainText can use the 
		results of a previous search
	 */
	SearchOptionsView.prototype.canConstrain = function(searchText, constrainText)
	{
		return (searchText.length == 0 || constrainText.indexOf(searchText) == 0);
	}
	
	SearchOptionsView.prototype.clearSearchTimeout = function()
	{
		if (this._searchTimeout != null)
		{
			clearTimeout(this._searchTimeout);
			this._searchTimeout = null;
		}
	}
	
	SearchOptionsView.prototype.restartSearchTimeout = function(val)
	{
		if (this.searchPath(val) === "")
			this.cancelSearch();
		else
			this.startSearchTimeout(val);
	}
	
	SearchOptionsView.prototype.textChanged = function()
	{
		this.clearSearchTimeout();
		
		var val = this.inputCompareText();
		if (val.length == 0)
		{
			this.textCleared();
		}
		else if (this._foundCompareText != null && 
				 this.canConstrain(this._foundCompareText, val))
		{
			if (this.getDataChunker.hasShortResults())
			{
				this.setConstrainText(val);
				this.constrainFoundObjects();
			}
			else
				this.startSearchTimeout(val);
		}
		else 
			this.restartSearchTimeout(val);
	}
	
	/* Returns an 'ol' element that contains the results of the search. */
	SearchOptionsView.prototype.appendSearchArea = function()
	{
		throw new Error("SearchOptionsView.appendSearchArea must be overridden");
	}

	return SearchOptionsView;
})();

/* A SearchView is a SearchOptionsView with its own input box. */
var SearchView = (function () {
	SearchView.prototype = new SearchOptionsView;
	SearchView.prototype.inputBox = null;
	
	function SearchView(containerNode, placeholder, chunkerType) {
		console.assert(containerNode);

		var _this = this;
		if (placeholder)
		{
			var inputBox = this.appendInput(containerNode, placeholder);
	
			this.inputBox = inputBox.node();
			$(this.inputBox).on("input", function() { _this.textChanged() });
		}
		
		SearchOptionsView.call(this, containerNode, chunkerType);
	}
	
	SearchView.prototype.inputText = function(val)
	{
		if (val === undefined)
			return this.inputBox ? this.inputBox.value.trim() : "";
		else
		{
			if (this.inputBox)
			{
				this.inputBox.value = val;
				$(this.inputBox).trigger("input");
			}
		}
	}
	
	SearchView.prototype.appendInput = function(containerNode, placeholder)
	{
		var searchBar = d3.select(containerNode).append("div").classed("searchbar", true);
	
		var searchInputContainer = searchBar.append("div")
			.classed("search-input-container", true);
		
		return searchInputContainer
			.append("input")
			.classed("search-input", true)
			.attr("placeholder", placeholder);
	}
	
	return SearchView;
})();

/* A PanelSearchView is a SearchView that appears in an entire sitePanel. */
var PanelSearchView = (function() {
	PanelSearchView.prototype = Object.create(SearchView.prototype);
	PanelSearchView.prototype.constructor = PanelSearchView;

	PanelSearchView.prototype.sitePanel = undefined
	
	function PanelSearchView(sitePanel, placeholder, chunkerType) {
		if (sitePanel)
		{
			/* Set sitePanel first for call to appendSearchArea */
			this.sitePanel = sitePanel;
			SearchView.call(this, sitePanel.node(), placeholder, chunkerType);
			
			var _this = this;
			
			/* Clear any search timeout that is pending. */
			$(sitePanel.node()).on("hiding.cr", function()
			{
				_this.clearSearchTimeout();
				_this.getDataChunker.clearLoadingMessage();
			});
		}
		else
			SearchView.call(this);
	}
	
	PanelSearchView.prototype.appendSearchArea = function()
	{
		return crf.appendItemList(this.sitePanel.appendScrollArea())
			.classed('hover-items', true);
	}
	
	return PanelSearchView;
})();

var Dimmer = (function () {
	Dimmer.prototype.dimmerDiv = null;
	function Dimmer(panelNode)
	{
		this.dimmerDiv = d3.select(panelNode).append('div')
			.classed('dimmer', true);
	}
	
	Dimmer.prototype.show = function()
	{
		return $(this.dimmerDiv.node()).animate({opacity: 0.3}, 200)
			.promise();
	}
	
	Dimmer.prototype.hide = function()
	{
		return $(this.dimmerDiv.node()).animate({opacity: 0}, {duration: 200, complete:
			function()
			{
				d3.select(this).remove();
			}})
			.promise();
	}
	
	Dimmer.prototype.remove = function()
	{
		this.dimmerDiv.remove();
	}
	
	Dimmer.prototype.mousedown = function(f)
	{
		$(this.dimmerDiv.node()).mousedown(f);
	}
	
	return Dimmer;
})();

function revealPanelLeft(panelDiv)
{
	panelDiv.sitePanel.showLeft().always(unblockClick);
}

function revealPanelUp(panelDiv)
{
	return panelDiv.sitePanel.showUp()
		.always(unblockClick);
}

var EditPanel = (function() {
	EditPanel.prototype = Object.create(crv.SitePanel.prototype);
	EditPanel.prototype.constructor = EditPanel;

	EditPanel.prototype.navContainer = null;
	
	EditPanel.prototype.createRoot = function(objectData, header, onShow)
	{
		crv.SitePanel.prototype.createRoot.call(this, objectData, header, "edit", onShow);
		this.navContainer = this.appendNavContainer();
		this.appendScrollArea();
	}

	function EditPanel()
	{
	}
	
	return EditPanel;
})();

var EditItemPanel = (function () {
	EditItemPanel.prototype = Object.create(EditPanel.prototype);
	EditItemPanel.prototype.constructor = EditItemPanel;

	EditItemPanel.prototype._controller = null;
	
	EditItemPanel.prototype.newInstance = function()
	{
		return this._controller.newInstance();
	}

	EditItemPanel.prototype.controller = function()
	{
		return this._controller;
	}
	
	EditItemPanel.prototype.promiseUpdateChanges = function()
	{
		return this.controller().save();
	}
	
	EditItemPanel.prototype.onConfirmDelete = function(data, d, deleteControl)
	{
		/* Test case: Delete an existing value in a cell that has multiple values. */
		if (prepareClick('click', 'confirm delete: ' + d.description()))
		{
			try {
				cr.removeElement(data, d);
				removeItem($(deleteControl).parents('li')[0], unblockClick);
			} catch(err) { cr.syncFail(err); }
		}
	}
	
	EditItemPanel.prototype.appendItemControls = function(itemsDiv, items, data, appendInputControls)
	{
		var _this = this;
		
		crf.appendDeleteControls(items);
		appendInputControls(items);
		crf.appendConfirmDeleteControls(items, function(d)
			{
				_this.onConfirmDelete(data, d, this);
			});
		var dials = $(itemsDiv.node()).find('li>button:first-of-type');
		crf.showDeleteControls(dials, 0);
		items.each(function(d)
			{
				setupOneViewEventHandler(d, 'deleted.cr', this, function(eventObject)
					{
						var item = d3.select(eventObject.data);
						item.remove();
					});
			});
	}

	
	/** Adds a row to a multiple item within a panel to add another item of that type. */
	EditItemPanel.prototype.appendAddButton = function(sectionObj, container, data, dataType, name, appendInputControls)
	{
		var _this = this;
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div")
			.classed('add-value site-active-text', true)
			.on("click", function(cell) {
				if (prepareClick('click', "add {0}".format(name)))
				{
					try
					{
						var newValue = new dataType();
						newValue.setDefaultValues();
						if ('position' in newValue)
							newValue.position(data.length ? parseInt(data[data.length - 1].position()) + 1 : 0);
							
						data.push(newValue);
						newValue.parent(container);
					
						var itemsDiv = sectionObj.selectAll('ol');
						var item = itemsDiv.append('li')
							.datum(newValue);
						_this.appendItemControls(itemsDiv, item, data, appendInputControls);
						itemsDiv.style('display', null);
						var input = item.selectAll('input');
						if (input.node())
							input.node().focus();
							
						unblockClick();
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			});
		buttonDiv.append('div')
			.classed('overlined', !sectionObj.classed('first'))
			.text("Add {0}".format(name));
	}

	/** Adds a section that contains a unique text block. 
		instanceProperty is a function that can get or set its value.
	 */
	EditItemPanel.prototype.appendTextSection = function(instance, instanceProperty, labelText, inputType)
	{
		var section = this.mainDiv.append('section')
			.datum(instance)
			.classed('cell edit unique', true)
			.on('focusout', function(d)
				{
					instanceProperty.call(instance, d3.select(this).select('input').property('value'));
				});
		section.append('label')
			.text(labelText);
		this.appendTextEditor(section, 
							  labelText,
							  instanceProperty.call(instance),
							  inputType);
		return section;	 
	}
	
	EditItemPanel.prototype.appendTextEditor = function(section, placeholder, value, inputType)
	{
		var itemsDiv = crf.appendItemList(section);
		var items = itemsDiv.append('li');

		var inputs = items.append('input')
			.classed('growable', true)
			.attr('type', inputType)
			.attr('placeholder', placeholder)
			.property('value', value);
			
		if (this.onFocusInOtherInput !== undefined)
		{
			var _this = this;
			inputs.on('click', function()
				{
					try
					{
						var done = function() { };
						if (!_this.onFocusInOtherInput(null, done))
						{
							done();
						}
					}
					catch (err)
					{
						cr.asyncFail(err);
					}
				});
		}
		
		return inputs;
	}
	
	EditItemPanel.prototype.appendDateSection = function(instance, instanceProperty, labelText, minDate, maxDate, placeholder)
	{
		placeholder = (placeholder !== undefined) 
			? placeholder : crv.buttonTexts.nonePlaceholder;
		
		var section = this.mainDiv.append('section')
			.datum(instance)
			.classed('cell edit unique', true);
		section.append('label')
			.classed('overlined', true)
			.text(labelText);
		section.editor = this.appendDateEditor(section, placeholder,
											   instanceProperty.call(instance),
											   minDate, maxDate);
		
		var handler = function(eventObject)
		{
			var dateWheelValue = this.value() != '' ? this.value() : null;
			instanceProperty.call(instance, dateWheelValue);
		}
		$(section.editor.dateWheel).on('change', null, handler);
		$(section.node()).on("clearTriggers.cr remove", section.editor.dateWheel, function()
			{
				$(section.editor.dateWheel).off('change', handler);
			});

		return section;
		
	}
	
	EditItemPanel.prototype.ensureDateEditorVisible = function(editor)
	{
		var dateSpan = editor.dateSpan;
		var reveal = editor.wheelReveal;
		
		if (!reveal.isVisible())
		{
			try
			{
				var done = function()
				{
					dateSpan.classed('site-active-text', true);
					reveal.show({}, 200, undefined, function()
						{
							editor.dateWheel.onShowing();
						});
					if (editor.canShowNotSureReveal)
						editor.notSureReveal.show({duration: 200});
				}
				if (!this.onFocusInOtherInput(reveal, done))
				{
					done();
				}
			}
			catch (err)
			{
				cr.asyncFail(err);
			}
		}
	}
	
	EditItemPanel.prototype.appendDateEditor = function(section, placeholder, value, minDate, maxDate)
	{
		/* If minDate is not defined, set it to January 1, 50 years ago. */
		if (minDate === undefined)
		{
			minDate = new Date();
			minDate.setUTCFullYear(minDate.getUTCFullYear() - 50);
			minDate.setMonth(0);
			minDate.setDate(1);
		}
		/* If maxDate is not defined, set it to December 31, 50 years hence. */
		if (maxDate === undefined)
		{
			maxDate = new Date();
			maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 50);
			maxDate.setMonth(11);
			maxDate.setDate(31);
		}
		
		var _this = this;
		var itemsDiv = crf.appendItemList(section)
			.classed('overlined', true);
		var itemDiv = itemsDiv.append('li');
		var dateSpan = itemDiv.append('span')
			.classed('growable', true);
		var dateWheel = new DateWheel(section.node().parentNode, function(newDate)
			{
				if (newDate)
					dateSpan.text(getLocaleDateString(newDate));
				else
					dateSpan.text(placeholder);
			}, minDate, maxDate);

		var reveal = new VerticalReveal(dateWheel.node());
		reveal.hide();
		
		var editor = null;
		dateSpan.on('click', function()
			{
				if (!reveal.isVisible())
				{
					_this.ensureDateEditorVisible(editor);
				}
				else
				{
					hideWheel();
				}
			});
		
		var notSureButton = d3.select(section.node().parentNode).append('div')
				.classed('not-sure-button site-active-text', true)
				.on('click', function()
					{
						if (prepareClick('click', placeholder))
						{
							hideWheel();
							dateWheel.clear();
							$(dateWheel).trigger('change');
							dateSpan.text(placeholder);
							unblockClick();
						}
					});
		notSureButton.append('div').text(placeholder);
		var notSureReveal = new VerticalReveal(notSureButton.node());
		notSureReveal.hide();
			
		var hideWheel = function(done)
		{
			dateSpan.classed('site-active-text', false);
			dateWheel.onHiding();
			reveal.hide({duration: 200,
						 before: function()
						 	{
						 		notSureReveal.hide({duration: 200,  before: done});
						 	}});
		}
		
		var showWheel = function(done)
		{
			dateSpan.classed('site-active-text', true);
			reveal.show({}, 200, undefined,
				function()
				{
					if (editor.canShowNotSureReveal)
						notSureReveal.show({done: done});
				});
			
		}
		
		if (value)
			dateWheel.value(value);
		else
			dateWheel.clear();

		editor = {dateSpan: dateSpan,
		    dateWheel: dateWheel, 
		    wheelReveal: reveal,
			notSureReveal: notSureReveal,
			hideWheel: hideWheel,
			showWheel: showWheel,
			canShowNotSureReveal: true
		};
		return editor;
	}
	
	EditItemPanel.prototype.appendTranslationsSection = function(instance, sectionLabel, placeholder, data, dataType)
	{
		var section = this.mainDiv.append('section')
			.datum(instance)
			.classed('cell edit multiple', true);
		section.append('label')
			.text(sectionLabel);
		this.appendTranslationEditor(section, instance, sectionLabel, placeholder, data, dataType);
		return section;
	}

	EditItemPanel.prototype.appendTranslationEditor = function(section, container, sectionLabel, placeholder, data, dataType)
	{
		var _this = this;
		section.classed("string translation", true);
		var itemsDiv = crf.appendItemList(section);
	
		function appendInputControls(items)
		{
			items.append('input')
				.classed('growable', true)
				.attr('type', 'text')
				.attr('placeholder', placeholder)
				.property('value', function(d) { return d.text(); })
				.on('focusout', function(d)
					{
						d.text(this.value);
					});

			var languageSelect = items.append("select");
			languageSelect.selectAll('option')
				.data(crv.languages)
				.enter()
				.append('option')
				.text(function(d) { return d.name; });
				
			languageSelect.each(function(d)
			{
				for (var i = 0; i < crv.languages.length; ++i)
				{
					if (crv.languages[i].code == d.language())
					{
						this.selectedIndex = i;
						break;
					}
				}
			});
			
			languageSelect.on('change', function(d)
				{
					d.language(crv.languages[this.selectedIndex].code);
				});
		}
	
		itemsDiv.classed('deletable-items', true);
		var items = appendItems(itemsDiv, data);
		
		this.appendItemControls(itemsDiv, items, data, appendInputControls);

		this.appendAddButton(section, container, data, dataType, placeholder, appendInputControls);
	}
	
	EditItemPanel.prototype.appendOrderedTextEditor = function(section, container, sectionLabel, placeholder, data, dataType)
	{
		var _this = this;
		section.classed("string translation", true);
		
		var itemsDiv = crf.appendItemList(section);
	
		function appendInputControls(items)
		{
			items.append('input')
				.classed('growable', true)
				.attr('type', 'text')
				.attr('placeholder', placeholder)
				.property('value', function(d) { return d.text(); })
				.on('focusout', function(d)
					{
						d.text(this.value);
					});
		}
	
		itemsDiv.classed('deletable-items', true);
		var items = appendItems(itemsDiv, data);
		
		this.appendItemControls(itemsDiv, items, data, appendInputControls);

		this.appendAddButton(section, container, data, dataType, placeholder, appendInputControls);
	}
	
	/** 
		returns the d3 object that contains the value.
	 */
	EditItemPanel.prototype.uniqueValueItem = function(section)
	{
		return section.selectAll('li');
	}
	
	EditItemPanel.prototype.appendUniqueValue = function(labelText, value)
	{
		var section = this.mainDiv.append('section')
			.classed('cell edit unique', true);
		section.append('label')
			.text(labelText);
		this.appendEnumerationEditor(section, value);
		return section;
	}
	
	/** Appends an enumeration that is associated with a picker panel for picking new values. */
	EditItemPanel.prototype.appendEnumerationPickerSection = function(instance, instanceProperty, labelText, pickPanelType)
	{
		var initialDescription = pickPanelType.prototype.getDescription(instanceProperty.call(instance));
		var section = this.appendUniqueValue(labelText, initialDescription)
			.datum(instance)
			.on('click', 
				function(d) {
					if (prepareClick('click', 'pick ' + labelText))
					{
						try
						{
							var panel = new pickPanelType();
							var textContainer = d3.select(this).selectAll('div.description-text');
							panel.createRoot(d, instanceProperty.call(instance))
								 .showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newValue)
								{
									textContainer.text(panel.getDescription(newValue));
									instanceProperty.call(instance, newValue);
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});
				
		crf.appendRightChevrons(this.uniqueValueItem(section));	
		return section;
	}
	
	EditItemPanel.prototype.appendLinkSection = function(instanceProperty, sectionLabel, pickPanelType)
	{
		var instance = this.controller().newInstance();
		var newLink = instanceProperty.call(instance);
		var section = this.appendUniqueValue(sectionLabel, 
			newLink ? newLink.description() : crv.buttonTexts.nullString)
			.datum(newLink)
			.on('click', 
				function() {
					if (prepareClick('click', 'pick organization'))
					{
						try
						{
							var panel = new pickPanelType(instance.parent(), instance);
							panel.createRoot(instance, instanceProperty.call(instance))
								.showLeft().then(unblockClick);
						
							$(panel.node()).on('itemPicked.cr', function(eventObject, newLink)
								{
									/* newLink will be undefined if null was passed in. */
									instanceProperty.call(instance, newLink || null);
									section.selectAll('li>div').text(
										newLink ? newLink.description() : crv.buttonTexts.nullString);
								});
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
			});

		crf.appendRightChevrons(this.uniqueValueItem(section));	
		return section;
	}
	
	EditItemPanel.prototype.appendEnumerationEditor = function(section, newValue)
	{
		var itemsDiv = crf.appendItemList(section);

		var items = itemsDiv.append('li');

		var divs = items.append('div')
			.classed('description-text growable unselectable', true)
			.text(newValue);
			
		return items;
	}
	
	EditItemPanel.prototype.appendChildrenPanelButton = function(label, panelType)
	{
		var _this = this;
		var childrenButton = this.appendActionButton(label, function() {
				if (prepareClick('click', label))
				{
					showClickFeedback(this);
					try
					{
						_this.controller().newInstance().calculateDescription();	/* In case a child needs to refer to this object */
						var panel = new panelType(_this.controller().newInstance(), revealPanelLeft);
						panel.showLeft().then(unblockClick);
					}
					catch(err) { cr.syncFail(err); }
				}
			})
			.classed('first', true);
		childrenButton.selectAll('li>div').classed('description-text', true);
		crf.appendRightChevrons(childrenButton.selectAll('li'));	
	}
	
	EditItemPanel.prototype.createRoot = function(header, onShow, canCancel)
	{
		canCancel = (canCancel !== undefined) ? canCancel : true;
		var _this = this;
		EditPanel.prototype.createRoot.call(this, null, header, onShow);

		if (canCancel)
		{
			this.navContainer.appendLeftButton()
				.on("click", function()
					{
						if (prepareClick('click', header + ' Cancel'))
						{
							_this.hide();
						}
						d3.event.preventDefault();
					})
				.append('span').text(crv.buttonTexts.cancel);
		}
		
		this.navContainer.appendTitle(header);
		
		var doneButton = this.navContainer.appendRightButton()
			.classed('default-link', true);
			
		doneButton.on('click', function()
			{
				if (prepareClick('click', header + ' done'))
				{
					showClickFeedback(this);
		
					if (_this.onFocusInOtherInput !== undefined)
					{
						_this.onFocusInOtherInput(null, function() {});
					}

					try
					{
						// Build up an update for initialData.
						_this.promiseUpdateChanges()
							.then(function() { _this.hide(); },
								  cr.syncFail)
					}
					catch(err) { cr.syncFail(err); }
				}
			})
		.append('span').text(this._controller.oldInstance() ? crv.buttonTexts.done : crv.buttonTexts.add);
	}
	
	function EditItemPanel(controller)
	{
		this._controller = controller;
		EditPanel.call(this);
	}
	
	return EditItemPanel;
})();

/* 
	Displays a panel for editing the specified object. 
 */
var PickFromListPanel = (function () {
	PickFromListPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickFromListPanel.prototype.constructor = PickFromListPanel;
	PickFromListPanel.prototype.oldDescription = null;
	
	PickFromListPanel.prototype.isInitialValue = function(d)
	{
		return this.datumDescription(d) === this.oldDescription;
	}

	PickFromListPanel.prototype.pickedValue = function(d)
	{
		return this.datumDescription(d);
	}

	PickFromListPanel.prototype.createRoot = function(datum, headerText, oldDescription)
	{
		crv.SitePanel.prototype.createRoot.call(this, datum, headerText, 'list', revealPanelLeft);
		var _this = this;
		
		this.navContainer = this.appendNavContainer();

		this.appendBackButton();
	
		this.navContainer.appendTitle(this.title);

		var section = this.appendScrollArea().append("section")
			.classed("cell multiple", true);
		var itemsDiv = crf.appendItemList(section)
			.classed('hover-items', true);
			
		var items = itemsDiv.selectAll('li')
			.data(this.data())
			.enter()
			.append('li');
		
		items.append("div")
			.classed("description-text growable unselectable", true)
			.text(function(d) { return _this.datumDescription(d); });
		
		this.oldDescription = oldDescription;		
		items.filter(function(d, i)
			{
				return _this.isInitialValue(d);
			})
			.insert("span", ":first-child").classed("glyphicon glyphicon-ok", true);
				
		items.on('click', function(d, i)
				{
					if (_this.isInitialValue(d))
						return;
					
					if (prepareClick('click', _this.datumDescription(d)))
					{
						try
						{
							$(_this.node()).trigger('itemPicked.cr', _this.pickedValue(d));
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

	function PickFromListPanel() {
		crv.SitePanel.call(this);
	}
	
	return PickFromListPanel;

})();

