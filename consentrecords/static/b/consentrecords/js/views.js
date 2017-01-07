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
			if (child.css("display") != "none" && 
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

<!-- Block of code for an alert area at the top of the window -->
bootstrap_alert = function() {}
bootstrap_alert.panel = null;
bootstrap_alert.timeout = null;
bootstrap_alert.closeOnTimeout = false;
bootstrap_alert.show = function(parentDiv, message, alertClass) {
	bootstrap_alert.closeOnTimeout = false;
	if (bootstrap_alert.timeout)
		clearTimeout(bootstrap_alert.timeout);
	bootstrap_alert.timeout = setTimeout(function()
		{
			bootstrap_alert.timeout = null;
			if (bootstrap_alert.closeOnTimeout)
				bootstrap_alert.close();
		}, 1500);
		
	if (bootstrap_alert.panel == null)
	{
		bootstrap_alert.alertClass = alertClass;
		var panel = d3.select('body').append('div')
			.classed('alert', true)
			.classed(alertClass, true)
			.style('z-index', 1000);
		bootstrap_alert.panel = panel.node();
		
		var closeButton = panel.append('button')
			.classed('close', true)
			.attr('aria-hidden', 'true')
			.text('\u00D7');
		$(closeButton.node()).focus();
		panel.selectAll('span')
			.data(message.toString().split('\n'))
			.enter()
			.append('span')
			.text(function(d) { return d; });
		panel.on('click', bootstrap_alert.close);
		$(closeButton.node()).on('focusout', bootstrap_alert.close);
		
		$(bootstrap_alert.panel).offset({top: $(window).innerHeight(), 
										 left: $(bootstrap_alert.panel).css('margin-left')})
			.animate({'top': ($(window).innerHeight() - $(bootstrap_alert.panel).height()) / 3});
	}
	else
	{
		var panel = d3.select(bootstrap_alert.panel);
		
		panel.classed(bootstrap_alert.alertClass, false);
		bootstrap_alert.alertClass = alertClass;
		panel.classed(bootstrap_alert.alertClass, true);
		panel.select('span').text(message);
		$(bootstrap_alert.panel)
			.animate({'top': ($(window).innerHeight() - $(bootstrap_alert.panel).height()) / 3});
	}
}
bootstrap_alert.warning = function(message) {
	bootstrap_alert.show(null, message, "alert-danger");
}
bootstrap_alert.success = function(message) {
	bootstrap_alert.show(null, message, "alert-success");
}
bootstrap_alert.close = function()
{
	if (bootstrap_alert.timeout)
	{
		bootstrap_alert.closeOnTimeout = true;
	}
	else
	{
		if (bootstrap_alert.panel)
		{
			bootstrap_alert.closeOnTimeout = false;
			var panel = bootstrap_alert.panel;
			bootstrap_alert.panel = null;
			$(panel)
				.animate({'left': -$(window).innerWidth()})
				.promise()
				.done(function()
					{
						$(panel).remove();
					});
		}
	}
}

closealert = bootstrap_alert.close;

var crv = {
	/* Reference https://www.loc.gov/standards/iso639-2/php/code_list.php */
	defaultLanguageCode: "en",
	languages: [{code: "en", name: "English"}, 
			    {code: "sp", name: "Spanish"},
			    {code: "zh", name: "Chinese"}],
			    
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

	appendAddButton: function(sectionObj, done)
	{
		var cell = sectionObj.datum();
		
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div").classed('add-value', true)
			.append("button").classed("btn row-button site-active-text", true)
			.on("click", function(cell) {
				if (prepareClick('click', 'add ' + cell.field.name))
				{
					try
					{
						if (done)
							done();
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").text("Add " + cell.field.name);
	},
};

function syncFailFunction(error)
{
	cr.logRecord('sync fail', error);
	if (typeof(error) == 'object' && 'stack' in error)
		cr.logRecord('sync fail stack', error.stack);
	bootstrap_alert.warning(error, ".alert-container");
	unblockClick();
}

/* A default function used to report an error during an asynchronous operation
	without unblocking a user event. */
function asyncFailFunction(error)
{
	cr.logRecord('async fail', error);
	if (typeof(error) == 'object' && 'stack' in error)
		cr.logRecord('async fail stack', error.stack);
	bootstrap_alert.warning(error, ".alert-container");
	/* Don't unblock here, because there was no block. */
}

cr.syncFail = syncFailFunction;
cr.asyncFail = asyncFailFunction;
		
var clickBlockCount = 0;

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
		throw ("Click over blocked");
	clickBlockCount += 1;
}

/* Unblocks clicks on the page. */			
function unblockClick()
{
	if (clickBlockCount === 0)
		throw ("Click unblocked.");
	clickBlockCount -= 1;
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

function _isPickCell(cell)
{
	if (("objectAddRule" in cell.field) &&
			 (cell.field["objectAddRule"] == "_pick one" ||
			  cell.field["objectAddRule"] == "_pick or create one"))
		return true;
	else
		return false;
}

function _pushTextChanged(d) {
	var f = function(eventObject) {
		d3.select(eventObject.data).text(this.getDescription());
	}
	
	setupOnViewEventHandler(d, "dataChanged.cr", this, f);
	
	if (d.cell && d.cell.isUnique())
	{
		setupOnViewEventHandler(d, "valueDeleted.cr", this, f);
	}
}

function _getDataValue(d) { return d.text; }
function _getDataDescription(d) { return d.getDescription() }

function checkItemsDisplay(node)
{
	var classList = node.parentNode.classList;
	var isUnique = classList.contains("unique");
	var isEdit = classList.contains("edit");
	
	var itemsDiv = d3.select(node);
	var items = itemsDiv.selectAll("li");
	
	var isVisible;
	
	if (isEdit)
		isVisible = true;
	else
	{
		isVisible = false;
		items.each(function(d)
		{
			isVisible |= !d.isEmpty();
		});
	}
		
	itemsDiv.style("display", (isUnique || isVisible) ? null : "none");
	/* In addition to the itemsDiv, hide the section if we are in view mode. */
	d3.select(node.parentNode).style("display", (isEdit || isVisible) ? null : "none");
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

function _setupItemsDivHandlers(itemsDiv, cell)
{
	node = itemsDiv.node();
	function checkVisible(eventObject)
	{
		checkItemsDisplay(eventObject.data);
	}
	setupOnViewEventHandler(cell, "dataChanged.cr", node, checkVisible);
	checkItemsDisplay(node);
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
	/* This method may be called for a set of items that were gotten directly and are not
		part of a cell. Therefore, we have to test whether d.cell is not null.
	 */
	if ($(this).parents(".multiple").length > 0)
	{
		var f = function(eventObject)
		{
			removeItem(eventObject.data, done);
		}
		setupOneViewEventHandler(d, "valueDeleted.cr", this, f);
	}
}

function _showViewStringCell(obj, cell)
{
	var sectionObj = d3.select(obj);
	
	var itemsDiv = sectionObj.selectAll("ol");

	if (cell.isUnique())
		itemsDiv.classed("right-label", true);

	var setupItems = function(divs, cell) {
		divs.classed("multi-line-item", !cell.isUnique())
		.append("div")
		.classed("description-text string-value-view", true)
		.text(_getDataValue)
		.each(_pushTextChanged);
	}
		
	function addedValue(eventObject, newValue)
	{
		setupItems(appendItem(d3.select(eventObject.data), newValue), this);
	}
	setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), addedValue);
	
	var divs = appendItems(itemsDiv, cell.data);
	setupItems(divs, cell);
}

function _showEditStringCell(obj, cell, inputType)
{
	var sectionObj = d3.select(obj).classed("string", true);
	
	if (cell.isUnique())
	{
		var itemsDiv = sectionObj.append("ol");

		var divs = itemsDiv.selectAll("li")
			.data(cell.data)
			.enter()
			.append("li")
			.classed("string-input-container", true);	// So that each item appears on its own row.
	
		var label = cell.field.label || cell.field.name;
		divs.append("input")
			.attr("type", inputType)
			.attr("placeholder", label)
			.property("value", _getDataValue);

		if (cell.field.descriptorType != "_by text")
		{
			var labelDiv = sectionObj.insert("label", ":first-child")
				.text(label);
		}
	}
	else
	{
		cell.appendLabel(obj);
		var itemsDiv = sectionObj.append("ol");

		var divs = appendItems(itemsDiv, cell.data);
		
		var appendControls = function(divs, cell)
		{	
			appendConfirmDeleteControls(divs);
			
			/* Inner layer needed so that padding is applied to inner content but not 
				confirm delete control
			 */
			var innerDivs = divs.append("div")
				.classed("multi-row-content", true);
		
			appendDeleteControls(innerDivs);

			inputContainers = innerDivs.append("div")
				.classed("string-input-container", true);						
	
			inputContainers.append("input")
				.attr("type", inputType)
				.attr("placeholder", cell.field.name)
				.property("value", _getDataValue);
		}
		
		appendControls(divs, cell);

		function appendNewValue(eventObject, newValue)
			{
				var div = appendItem(d3.select(eventObject.data), newValue);
				
				appendControls(div, this);
				$(eventObject.data).css("display", "");	
			}
		setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), appendNewValue);
		_setupItemsDivHandlers(itemsDiv, cell);
			
		crv.appendAddButton(sectionObj, function()
			{
				var newValue = cell.addNewValue();
				unblockClick();
			});
	}
}

function _showEditDateStampDayOptionalCell(obj)
{
	var sectionObj = d3.select(obj).classed("string", true);
	
	function appendInputs(divs)
	{
	    divs.each(function(d)
	    {
	    	var input = new DateInput(this);
	    	var newValue = d.text;
	    	if (newValue && newValue.length > 0)
 				input.value(newValue);
	    });
	}
	
	if (this.isUnique())
	{
		var itemsDiv = sectionObj.append("ol");

		var divs = itemsDiv.selectAll("li")
			.data(this.data)
			.enter()
			.append("li")
			.classed("string-input-container", true);	// So that each item appears on its own row.
		appendInputs(divs);
	
		if (this.field.descriptorType != "_by text")
		{
			var labelDiv = sectionObj.insert("label", ":first-child")
				.text(this.field.label || this.field.name);
		}
	}
	else
	{
		this.appendLabel(obj);
		var itemsDiv = sectionObj.append("ol");

		var divs = appendItems(itemsDiv, this.data);
		
		var appendControls = function(divs, cell)
		{	
			appendConfirmDeleteControls(divs);
			
			/* Inner layer needed so that padding is applied to inner content but not 
				confirm delete control
			 */
			var innerDivs = divs.append("div")
				.classed("multi-row-content", true);
		
			appendDeleteControls(innerDivs);

			inputContainers = innerDivs.append("div")
				.classed("string-input-container", true);						
	
			appendInputs(inputContainers);
		}
		
		appendControls(divs, this);

		var _this = this;
		function appendNewValue(eventObject, newValue)
			{
				var div = appendItem(d3.select(eventObject.data), newValue);
				
				appendControls(div, this);	
				$(eventObject.data).css("display", "");	
			}
		setupOnViewEventHandler(this, "valueAdded.cr", itemsDiv.node(), appendNewValue);
		_setupItemsDivHandlers(itemsDiv, this);
			
		crv.appendAddButton(sectionObj, function()
			{
				var newValue = cell.addNewValue();
				unblockClick();
			});
	}
}

function _showEditTranslationCell(obj, cell, inputType)
{
	var sectionObj = d3.select(obj).classed("string translation", true);
	
	function appendInputControls(divs)
	{
		var languageSelect = divs.append("select");
		languageSelect.selectAll('option')
			.data(crv.languages)
			.enter()
			.append('option')
			.text(function(d) { return d.name; });
		languageSelect.each(function(d)
		{
			for (var i = 0; i < crv.languages.length; ++i)
			{
				if (crv.languages[i].code == d.languageCode)
				{
					this.selectedIndex = i;
					break;
				}
			}
		});
		
		divs.append("div")
			.classed("string-input-container", true)
			.append("input")
			.attr("type", "text")
			.attr("placeholder", cell.field.name)
			.property("value", _getDataValue);
	}
	
	if (cell.isUnique())
	{
		var itemsDiv = sectionObj.append("ol");

		var divs = itemsDiv.selectAll("li")
			.data(cell.data)
			.enter()
			.append("li");	// So that each item appears on its own row.
	
		appendInputControls(divs);

		if (cell.field.descriptorType != "_by text")
		{
			var labelDiv = sectionObj.insert("label", ":first-child")
				.text(cell.field.label || cell.field.name);
		}
	}
	else
	{
		cell.appendLabel(obj);
		var itemsDiv = sectionObj.append("ol");

		var divs = appendItems(itemsDiv, cell.data);
		
		var appendControls = function(divs, cell)
		{	
			appendConfirmDeleteControls(divs);
			
			/* Inner layer needed so that padding is applied to inner content but not 
				confirm delete control
			 */
			var innerDivs = divs.append("div")
				.classed("multi-row-content", true);
		
			appendDeleteControls(innerDivs);

			inputContainers = innerDivs.append("div");						
	
			appendInputControls(inputContainers);
		}
		
		appendControls(divs, cell);

		function appendNewValue(eventObject, newValue)
			{
				var div = appendItem(d3.select(eventObject.data), newValue);
				
				appendControls(div, this);	
				$(eventObject.data).css("display", "");	
			}
		setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), appendNewValue);
		_setupItemsDivHandlers(itemsDiv, cell);
			
		crv.appendAddButton(sectionObj, function()
			{
				var newValue = cell.addNewValue();
				unblockClick();
			});
	}
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
	
		/* Hide the new button if it is blank, and then show it if the data changes. */
		item.style("display", 
				   (cell.isUnique() || !newValue.isEmpty()) ? null : "none");
			   
		if (!cell.isUnique())
		{
			function checkVisible(eventObject)
			{
				d3.select(eventObject.data).style("display", 
					   !this.isEmpty() ? null : "none");
			}
			setupOnViewEventHandler(newValue, "dataChanged.cr", item.node(), checkVisible);
		}

		if (canDelete && !cell.isUnique())
			appendConfirmDeleteControls(item);
	
		var buttons = appendRowButtons(item);

		buttons.on("click", function(d) {
			if (prepareClick('click', 'view added item: ' + d.getDescription()))
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
			appendDeleteControls(buttons);
		if (canShowDetails)
			appendRightChevrons(buttons);

		appendButtonDescriptions(buttons)
			.each(_pushTextChanged);
			
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
				.classed("btn row-button multi-row-content", $(divs.node()).parents(".unique").length === 0);
}

function appendConfirmDeleteControls(divs, onClick)
{
	onClick = (onClick !== undefined ? onClick :
		function(d)
		{
			/* Test case: Delete an existing value in a cell that has multiple values. */
			if (prepareClick('click', 'confirm delete: ' + d.getDescription()))
				d.deleteValue(unblockClick, syncFailFunction);
		});
		
	divs.classed("delete-confirm-container", true);						
	
	return divs.append("button")
		.text("Delete")
		.style("width", "0px")
		.style("padding-left", "0px")
		.style("padding-right", "0px")
		.on('blur', function(e)
		{
			var deleteButton = $(this.parentNode).find(".glyphicon-minus-sign");
			deleteButton.animateRotate(180, 90, 400);
			$(this).animate({width: "0px", "padding-left": "0px", "padding-right": "0px"},
				{duration: 400,
				 step: function()
				 {
				 	$(this.parentNode).find('button.delete-dial~div').trigger('resize.cr');
				 }});
		})
		.on('click', onClick);
}

function appendDeleteControls(buttons)
{
	return buttons.append("button")
		.classed("glyphicon glyphicon-minus-sign pull-left", true)
		.on("click", function(e)
		{
			if (prepareClick('click', 'delete button'))
			{
				$(this).animateRotate(90, 180, 600, 'swing');
				var confirmButton = $($(this).parents('li')[0]).children("button");
				autoWidth = confirmButton.css('width', 'auto')
					.width();
				confirmButton.width(0)
					.animate({width: autoWidth+24, "padding-left": "12px", "padding-right": "12px"}, 600, 'swing', 
					function () 
					{ 
						unblockClick(); 
						this.focus();
					});
			};
			d3.event.preventDefault();
		});
}

function appendRightChevrons(buttons)
{
	var containers = buttons.append("div")
		.classed("site-chevron-right right-fixed-width-div right-vertical-chevron", true);
	containers
		.append("img")
		.attr("src", rightChevronPath)
		.attr("height", "18px");
	return containers;
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
		.classed("description-text string-value-view", true)
		.text(_getDataDescription);
}

function _clickEditObjectValue(d, backText)
{
	if (_isPickCell(d.cell))
	{
		if (prepareClick('click', 'pick object: ' + d.getDescription()))
			showPickObjectPanel(d.cell, d);
	}
	else
	{
		if (prepareClick('click', 'edit object: ' + d.getDescription()))
		{
			var getSavePromise;
			if (d.cell.parent)
				getSavePromise = null;
			else
			{
				/* Test case: Create an Organization, Site an Offering all in one operation. */
				getSavePromise = promiseImportCells;
			}
			showEditObjectPanel(d.cell, d, backText, revealPanelLeft, getSavePromise);
		}
	}
}

/* newValue is a string */
function _updateTextValue(d, newValue)
{
	/* If both are null, then they are equal. */
	if (!newValue && !d.text)
		newValue = d.text;

	if (newValue !== d.text)
	{
		d.text = newValue;
	}
}

/* "this" is the control containing the string. */
function _getDatestampValue()
{
	try
	{
		if (!this.value)
			return undefined;
		else
			return (new Date(this.value.trim())).toISOString().substring(0, 10);
	}
	catch(err)
	{
		return undefined;
	}
}

/* "this" is the control containing the string. */
function _getDatestampDayOptionalValue()
{
	var obj = d3.select(this);
	var dateObj = obj.selectAll(".date-row");
	return dateObj.node().dateInput.value();
}

/* "this" is the control containing the string. */
function _getTimeValue()
{
	try
	{
		if (!this.value)
			return undefined;
		else
			return Date.parse(this.value).toString("HH:mm");
	}
	catch(err)
	{
		return undefined;
	}
}

function _appendUpdateStringCommands(sectionObj, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("input").each(function(d, i)
		{
			var newValue = this.value.trim();
			d.appendUpdateCommands(i, newValue, initialData, sourceObjects);
		}
	);
}

function _appendUpdateDatestampCommands(sectionObj, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("input").each(function(d, i)
		{
			var newValue = _getDatestampValue.call(this);			
			d.appendUpdateCommands(i, newValue, initialData, sourceObjects);
		}
	);
}

function _appendUpdateDatestampDayOptionalCommands(sectionObj, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("li").each(function(d, i)
		{
			var newValue = _getDatestampDayOptionalValue.call(this);
			d.appendUpdateCommands(i, newValue, initialData, sourceObjects);
		}
	);
}

function _appendUpdateTimeCommands(sectionObj, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("input").each(function(d, i)
		{
			var newValue = _getTimeValue.call(this);
			d.appendUpdateCommands(i, newValue, initialData, sourceObjects);
		}
	);
}

function _getTranslationValue()
{
	var d3This = d3.select(this);
	var textInput = d3This.selectAll("input");
	var languageInput = d3This.selectAll("select");
	var sel = languageInput.node();
	var selectedOption = sel.options[sel.selectedIndex];
	var languageCode = d3.select(selectedOption).datum().code;

	return {text: textInput.property("value").trim(),
				languageCode: languageCode};
}

function _appendUpdateTranslationCommands(sectionObj, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("li").each(function(d, i)
		{
			var newValue = _getTranslationValue.call(this);
			d.appendUpdateCommands(i, newValue, initialData, sourceObjects);
		}
	);
}

function _updateTranslationValue(d, newValue)
{
	/* If both are null or undefined, then they are equal. */
	if (!newValue.text && !d.text)
		newValue.text = d.text;
		
	d.text = newValue.text;
	d.languageCode = newValue.languageCode;
}

function _updateStringCell(sectionObj)
{
	d3.select(sectionObj).selectAll("input").each(function(d)
		{
			_updateTextValue(d, this.value);
		}
	);
}

function _updateDatestampCell(sectionObj)
{
	d3.select(sectionObj).selectAll("input").each(function(d)
		{
			var newValue = _getDatestampValue.call(this);			
			_updateTextValue(d, newValue);
		}
	);
}

function _updateDatestampDayOptionalCell(sectionObj)
{
	d3.select(sectionObj).selectAll("li").each(function(d)
		{
			var newValue = _getDatestampDayOptionalValue.call(this);
			_updateTextValue(d, newValue);
		}
	);
}

function _updateTimeCell(sectionObj)
{
	d3.select(sectionObj).selectAll("input").each(function(d)
		{
			var newValue = _getTimeValue.call(this);
			_updateTextValue(d, newValue);
		}
	);
}

function _updateTranslationCell(sectionObj)
{
	d3.select(sectionObj).selectAll("li").each(function(d)
		{
			var newValue = _getTranslationValue.call(this);
			_updateTranslationValue(d, newValue);
		}
	);
}

cr.Cell.prototype.appendLabel = function(obj)
{
	return d3.select(obj).append("label")
		.text(this.field.label || this.field.name);
}

cr.StringCell.prototype.appendUpdateCommands = _appendUpdateStringCommands;
cr.StringCell.prototype.updateCell = _updateStringCell;
cr.StringCell.prototype.show = function(obj)
{
	_showViewStringCell(obj, this);
}
cr.StringCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "text");
}

cr.NumberCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "number");
}

cr.EmailCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "email");
}

cr.UrlCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "url");
}

cr.TelephoneCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "tel");
}

cr.DatestampCell.prototype.appendUpdateCommands = _appendUpdateDatestampCommands;
cr.DatestampCell.prototype.updateCell = _updateDatestampCell;
cr.DatestampCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "date");
}

cr.DatestampDayOptionalCell.prototype.appendUpdateCommands = _appendUpdateDatestampDayOptionalCommands;
cr.DatestampDayOptionalCell.prototype.updateCell = _updateDatestampDayOptionalCell;
cr.DatestampDayOptionalCell.prototype.showEdit = _showEditDateStampDayOptionalCell;

cr.TimeCell.prototype.appendUpdateCommands = _appendUpdateTimeCommands;
cr.TimeCell.prototype.updateCell = _updateTimeCell;
cr.TimeCell.prototype.showEdit = function(obj)
{
	_showEditStringCell(obj, this, "time");
}

cr.TranslationCell.prototype.appendUpdateCommands = _appendUpdateTranslationCommands;
cr.TranslationCell.prototype.updateCell = _updateTranslationCell;
cr.TranslationCell.prototype.showEdit = function(obj)
{
	_showEditTranslationCell(obj, this, "text");
}

cr.ObjectCell.prototype.appendUpdateCommands = function(sectionObj, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("ol>li").each(function(d, i)
		{
			if (d.id)
			{
				/* Do nothing. */ ;
			}
			else if (d.getCells())
			{
				/* This case is true if we are creating an object */
				var subData = {}
				$(d.getCells()).each(function()
				{
					this.appendData(subData);
				});
				{
					var command;
					command = {containerUUID: d.cell.parent.getInstanceID(), 
							   fieldID: d.cell.field.nameID, 
							   ofKindID: d.cell.field.ofKindID,
							   value: subData,
							   index: i};
					initialData.push(command);
					sourceObjects.push(d);
				}
			}
		}
	);
}

cr.ObjectCell.prototype.updateCell = function(sectionObj)
{
	/* Do nothing at the moment. */
}

cr.ObjectCell.prototype.show = function(obj, backText)
{
	var sectionObj = d3.select(obj);
	var itemsDiv = sectionObj.selectAll("ol");

	if (this.isUnique())
	{
		itemsDiv.classed("right-label", true);
		if (!_isPickCell(this))
			sectionObj.classed("btn row-button", true)
			          .on("click", function(cell) {
				if (prepareClick('click', 'view unique ' + cell.field.name + ': ' + cell.data[0].getDescription()))
				{
					showViewObjectPanel(cell, cell.data[0], backText, revealPanelLeft);
				}
			});
	}
	
	var addedFunction = getOnValueAddedFunction(false, !_isPickCell(this), showViewObjectPanel);

	this.on("valueAdded.cr", itemsDiv.node(), addedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			eventObject.data.off("valueAdded.cr", addedFunction);
		});
	
	var clickFunction;
	var _this = this;
	if (_isPickCell(this) || this.isUnique())	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
			if (prepareClick('click', 'view multiple ' + d.cell.field.name + ': ' + d.getDescription()))
			{
				showViewObjectPanel(_this, d, backText, revealPanelLeft);
			}
		}

	var divs = appendItems(itemsDiv, this.data);
	
	var buttons;
	if (!_isPickCell(this)) {
		buttons = appendRowButtons(divs);
	
		if (clickFunction)
			buttons.on("click", clickFunction);
		
		appendRightChevrons(buttons);
	}
	else
	{
		buttons = divs.append("div").classed("multi-line-item", !this.isUnique());
	}
	
	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
}

cr.ObjectCell.prototype.showEdit = function(obj, backText)
{
	var sectionObj = d3.select(obj);
	
	var labelDiv = this.appendLabel(obj);
	var itemsDiv = sectionObj.append("ol");

	if (this.isUnique())
	{
		sectionObj.classed("btn row-button", true);
		itemsDiv.classed("right-label", true);
		sectionObj.on("click", function(cell) {
			_clickEditObjectValue(cell.data[0], backText);
		});
	}

	
	var divs = appendItems(itemsDiv, this.data);
	
	if (!this.isUnique())
		appendConfirmDeleteControls(divs);
		
	var buttons = appendRowButtons(divs);

	if (!this.isUnique())
	{
		buttons.on("click", function(d) {
				_clickEditObjectValue(d, backText);
			});
		appendDeleteControls(buttons);
	}

	appendRightChevrons(buttons);	
		
	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
	
	var promise, promise2;
	if (!this.parent)
	{
		promise = promiseImportCells;
		promise2 = promiseImportCells;
	}
	else if (this.isUnique())
	{
		promise = promiseSaveCells;
		promise2 = null;	/* The added item will have an instance ID */
	}
	else
	{
		promise = promiseCreateObjectFromCells;
		promise2 = null;	/* The added item will have an instance ID */
	}
		
	var editFunction = _isPickCell(this) ? showPickObjectPanel : showEditObjectPanel;
	var addedEditFunction = _isPickCell(this) ? showPickObjectPanel :
		function(containerCell, objectData, backText, onShow)
		{
			showEditObjectPanel(containerCell, objectData, backText, onShow, promise2);
		}
		
	var addedFunction = getOnValueAddedFunction(true, true, addedEditFunction);

	this.on("valueAdded.cr", itemsDiv.node(), addedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			eventObject.data.off("valueAdded.cr", addedFunction);
		});
	
	if (!this.isUnique())
	{
		var _this = this;
		function done()
		{
			editFunction(_this, null, backText, revealPanelUp,
						promise);
		}
		
		crv.appendAddButton(sectionObj, done);
		_setupItemsDivHandlers(itemsDiv, this);
	}
}

function appendDescriptions(buttons)
{
	return buttons.append("div")
		.classed("description-text", true)
		.text(_getDataDescription)
		.each(_pushTextChanged);
}

function appendButtons(panel2Div, rootObjects, buttonClicked, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;
	
	var itemsDiv = panel2Div.append("section")
		.classed("multiple", true)
		.append("ol");

	var sections = itemsDiv.selectAll("li")
				.data(rootObjects)
				.enter()
				.append("li");

	return appendViewButtons(sections, fill)
		.on("click", buttonClicked);
}

/* Append a set of buttons to each section for displaying the text for each item. */
function appendViewButtons(sections, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;

	var buttons = sections.append("div").classed("btn row-button multi-row-content expanding-div", true);
	
	fill(buttons);
		
	return buttons;
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

	var divs = appendItems(container, cell.data);
	
	var buttons = appendRowButtons(divs);
	
	appendRightChevrons(buttons);

	appendDescriptions(buttons);
		
	buttons.on("click", clickFunction);
	
	return buttons;
}

/* Returns the set of objects that contain the description of each data element */
function appendEditCellItems(container, cell, clickFunction)
{
	// Remove any lingering contents.
	container.selectAll("li").remove();

	var divs = appendItems(container, cell.data);
	
	if (!cell.isUnique())
		appendConfirmDeleteControls(divs);
	
	var buttons = appendRowButtons(divs);
	
	if (!cell.isUnique())
		appendDeleteControls(buttons);
	appendRightChevrons(buttons);

	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
		
	buttons.on("click", clickFunction);
	
	return buttons;
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
		return this.div.append("div").classed("left-link pull-left site-navbar-link site-active-text", true);
	}
	
	SiteNavContainer.prototype.appendRightButton = function()
	{
		var firstChild = this.div.selectAll('div');
		var rightChild;
		if (firstChild.empty())
		{
			rightChild = this.div.append("div");
		}
		else
		{
			rightChild = this.div.insert("div", ":first-child");
			firstChild.classed("pull-left", !this.div.selectAll('div.site-navbar-commands').empty());
		}
			
		return rightChild.classed("right-link pull-right site-navbar-link site-active-text", true);
	}
	
	SiteNavContainer.prototype.setTitle = function(title)
	{
		var h = this.div.selectAll('.site-navbar-commands > .site-title');
		h.text(title)
			.style("width", (getTextWidth(title, h.style("font"))+1).toString() + "px");
	}
	
	SiteNavContainer.prototype.appendTitle = function(newTitle)
	{
		var h = this.div.append("div").classed("site-navbar-commands", true)
				   .append("div").classed("site-title", true);
		this.setTitle(newTitle);
		this.div.selectAll('.left-link').classed('pull-left', true);
		return h;
	}
	
	function SiteNavContainer(sitePanel)
	{
		this.nav = sitePanel.panelDiv.append("nav")
					.attr("role", "navigation")
		this.div = this.nav.append('div');
	}
	
	return SiteNavContainer;
})();

/* Creates a panel that sits atop the specified containerPanel in the same container. */
var SitePanel = (function () {
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
	
	SitePanel.prototype.appendSearchBar = function(textChanged)
	{
		var searchBar = this.panelDiv.append("div").classed("searchbar", true);
	
		var searchCancelButton = searchBar.append("span")
			.classed("search-cancel-button site-active-text", true);
		searchCancelButton.append("span").text("Cancel");
	
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
				searchCancelButton.selectAll('span').text("Cancel");
				$(searchCancelButton.node()).animate({width: searchCancelButtonWidth,
													  "padding-left": oldPaddingLeft,
													  "padding-right": oldPaddingRight}, 400, "swing");
			})
			.on("focusout", function(e)
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
				
			/* Trigger the resize in the next event to ensure that css widths and
				heights have been applied.
			 */
			setTimeout(function()
				{
					mainNode.trigger("resize.cr");
				});
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
		this.mainDiv.appendSection = function(datum)
		{
			return this.append("section").datum(datum);
		}
		
		this.mainDiv.isEmptyItems = function(itemsDiv)
		{
			var isEmpty = true;
			itemsDiv.selectAll("li")
				.each(function(d) { if (isEmpty && !d.isEmpty()) isEmpty = false; });
			return isEmpty;
		}
		
		this.mainDiv.appendCellData = function(sectionNode, cell)
		{
			var _thisPanel2Div = this;
			var section = d3.select(sectionNode);
			var itemsDiv = section.select("ol");
			cell.show(sectionNode, _this.headerText);
			$(sectionNode).css("display", _thisPanel2Div.isEmptyItems(itemsDiv) ? "none" : "");
			
			/* Make sure the section gets shown if a value is added to it. */
			var checkDisplay = function(eventObject, newValue)
			{
				$(eventObject.data).css("display", _thisPanel2Div.isEmptyItems(itemsDiv) ? "none" : "");
			}
			cell.on("valueAdded.cr valueDeleted.cr dataChanged.cr", sectionNode, checkDisplay);
			$(sectionNode).on("remove", null, cell, function(eventObject)
				{
					eventObject.data.off("valueAdded.cr valueDeleted.cr dataChanged.cr", checkDisplay);
				});
			_setupItemsDivHandlers(itemsDiv, cell);
		}
		
		this.mainDiv.handleDoneEditingButton = function(done) {
			if (prepareClick('click', 'done editing'))
			{
				showClickFeedback(this);
		
				try
				{
					var sections = _this.mainDiv.selectAll("section");
					var initialData = [];
					var sourceObjects = [];
					sections.each(function(cell) {
							/* cell may be null if this is a pseudo-section, such as for the Change Password
								section in the Settings panel.
							 */
							if (cell)
							{
								if ("appendUpdateCommands" in cell)
									cell.appendUpdateCommands(this, initialData, sourceObjects);
							}
						});
						
					var allDone = function() {
						if (done)
							done();
						_this.hide();
					}
					if (initialData.length > 0) {
						/* Test case: Change the text of an existing string or translation field and click Done */
						cr.updateValues(initialData, sourceObjects)
							.then(allDone, cr.syncFail);
					}
					else
					{
						allDone();
					}
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
			d3.event.preventDefault();
		}
		
		return this.mainDiv;
	}
	
	SitePanel.prototype.showViewCells = function(cells)
	{
		var _this = this;
		var sections = this.mainDiv.appendSections(cells.filter(function(cell) 
				{ 
					return cell.field.descriptorType != "_by text" 
				}))
			.classed("cell view", true)
			.classed("unique", function(cell) { return cell.isUnique(); })
			.classed("multiple", function(cell) { return !cell.isUnique(); })
			.each(function(cell) {
					var section = d3.select(this);
					cell.appendLabel(this);
					var itemsDiv = section.append("ol");
					_this.mainDiv.appendCellData(this, cell);
				});
		sections.append("div").classed("cell-border-below", true);
		
		return sections;
	}
	
	SitePanel.prototype.showEditCells = function(cells)
	{
		var _this = this;
		return this.mainDiv.appendSections(cells)
			.classed("cell edit", true)
			.classed("unique", function(cell) { return cell.isUnique(); })
			.classed("multiple", function(cell) { return !cell.isUnique(); })
			.each(function(cell) {
					cell.showEdit(this, _this.headerText);
				});
	}
	
	SitePanel.prototype.appendActionButton = function(text, onClick)
	{
		var sectionDiv = this.mainDiv.append('section')
			.classed('cell unique btn action', true)
			.on('click', onClick);
		var itemsDiv = sectionDiv.append('ol');
		
		var button = itemsDiv.append('li')
			.append('div');
			
		button.append('span')
			.classed("site-active-text string-value-view", true)
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
						left: "{0}px".format(window.innerWidth),
						position: 'fixed'});
		$panelNode.trigger("revealing.cr");
		return $panelNode.animate({left: 0})
			.promise()
			.done(function()
				{
					$panelNode.css('position', '');
				});
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
	
	SitePanel.prototype.hideRightEvent = function()
	{
		if (prepareClick('click', 'Close Right'))
			this.hideRight().then(unblockClick);
		else
			cr.logRecord('click', 'Close Right blocked');
		d3.event.preventDefault();
	}
	
	SitePanel.prototype.appendDeleteControls = function(buttons)
	{
		return buttons.append("button")
			.classed("delete-dial glyphicon glyphicon-minus-sign", true)
			.on("click", function(e)
			{
				if ($(this).css("opacity") > 0 &&
					prepareClick('click', 'delete button'))
				{
					var _this = this;
					$(this).animateRotate(90, 180, 600, 'swing');
					var confirmButton = $($(this).parents("li")[0]).children("button");
					autoWidth = confirmButton.css('width', 'auto')
						.width();
					confirmButton.width(0)
						.animate({width: autoWidth+24, "padding-left": "12px", "padding-right": "12px"}, 
							{duration: 600, 
							 easing: 'swing', 
							 step: function()
							 {
							 	$(_this).find("~ div").trigger('resize.cr');
							 },
							 done: function () 
							{ 
								unblockClick(); 
								this.focus();
							}});
				};
				d3.event.preventDefault();
			});
	}
	
	SitePanel.prototype.hideDeleteControlsNow = function(dials)
	{
		this.hideDeleteControls(dials, 0);
	}
	
	SitePanel.prototype.showDeleteControls = function(dials, duration)
	{
		duration = duration !== undefined ? duration : 400;
		dials = dials !== undefined ? dials : $(this.node()).find(".delete-dial");
		
		dials
			.css("display", "")
			.animate({left: "12px", opacity: 1}, duration);
		var adj = dials.find("~ div");
		if (adj.length > 0)
		{
			adj.animate({"margin-left": "24px"}, 
				{duration: duration,
				 step: function() {
				 		$(this).trigger('resize.cr');
				 	}});
		}
	}
	
	SitePanel.prototype.hideDeleteControls = function(dials, duration)
	{
		duration = duration !== undefined ? duration : 400;
		dials = dials !== undefined ? dials : $(this.node()).find(".delete-dial");
		
		dials
			.animate({left: "-12px", opacity: 0}, duration, function() {
					$(this).css("display", "none");
				});
		var adj = dials.find("~ div");
		if (adj.length > 0)
		{
			adj.animate({"margin-left": "0px"}, 
				{duration: duration,
				 step: function() {
				 		$(this).trigger('resize.cr');
				 	}});
		}
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
	SearchOptionsView.prototype._fill = null;
	SearchOptionsView.prototype._foundCompareText = null;
	SearchOptionsView.prototype._constrainCompareText = null;
	SearchOptionsView.prototype._searchTimeout = null;

	/* containerNode is the node that contains the noResults Div and the list 
		containing the results.
	 */
	function SearchOptionsView(containerNode, fill, chunkerType)
	{
		this._fill = fill;
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
		throw ("need to override SearchOptionsView.onClick");
	}
	
	SearchOptionsView.prototype.isButtonVisible = function(button, d, compareText)
	{
		throw ("need to override SearchOptionsView.isButtonVisible");
	}
	
	SearchOptionsView.prototype.searchPath = function(val)
	{
		throw ("need to override SearchOptionsView.searchPath");
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
			return a.getDescription().localeCompare(b.getDescription());
		}
		foundObjects.sort(sortByDescription);
	}
	
	SearchOptionsView.prototype.setConstrainText = function(val)
	{
		this._constrainCompareText = val;
	}
	
	SearchOptionsView.prototype.constrainFoundObjects = function()
	{
		var buttons = this.listElement.selectAll(".btn");
		var _this = this;
		buttons.style("display", function(d) 
			{ 
				if (_this.isButtonVisible(this, d, _this._constrainCompareText))
					return null;
				else
					return "none";
			});
	}
	
	/* Show the objects that have been found. In this implementation, the objects appear as a list of buttons. */
	SearchOptionsView.prototype.showObjects = function(foundObjects)
	{
		var _this = this;
		var sections = this.appendButtonContainers(foundObjects);
		var buttons = appendViewButtons(sections, this._fill)
			.on("click", function(d, i) {
				_this.onClickButton(d, i, this);
			});
		
		this.constrainFoundObjects();
		return buttons;
	}
	
	/* Overwrite this function to use a different set of fields for the getData or selectAll operation
		sent to the middle tier.
	 */
	SearchOptionsView.prototype.fields = function()
	{
		return ["parents"];
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
	
	SearchOptionsView.prototype.search = function(val)
	{
		if (val !== undefined)
		{
			this._foundCompareText = val;
			this._constrainCompareText = val;
		}
			
		var searchPath = this.searchPath(this._constrainCompareText);
		if (searchPath && searchPath.length > 0)
		{
			this.getDataChunker.path = searchPath;
			this.getDataChunker.fields = this.fields();
			this.getDataChunker.start(this._constrainCompareText);			
		}
		else
		{
			this.cancelSearch();
		}
	}
	
	SearchOptionsView.prototype.inputText = function(val)
	{
		throw ("need to override SearchOptionsView.inputText");
	}
	
	SearchOptionsView.prototype.inputCompareText = function()
	{
		return this.inputText().toLocaleLowerCase();
	}
	
	// Begin a timeout that, when it is done, begins a search.
	// This gives the user time to update the search text without 
	// doing a search for each change to the search text.
	SearchOptionsView.prototype.startSearchTimeout = function(val)
	{
		this.clearListPanel();
		if (this.searchPath(val) != "")
			this.getDataChunker.showLoadingMessage();
				
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
		this._searchTimeout = setTimeout(endSearchTimeout, 300);
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
		throw ("SearchOptionsView.appendSearchArea must be overridden");
	}

	return SearchOptionsView;
})();

/* A SearchView is a SearchOptionsView with its own input box. */
var SearchView = (function () {
	SearchView.prototype = new SearchOptionsView;
	SearchView.prototype.inputBox = null;
	
	function SearchView(containerNode, placeHolder, fill, chunkerType) {
		if (containerNode)
		{
			var _this = this;
			var inputBox = this.appendInput(containerNode, placeHolder);
		
			this.inputBox = inputBox.node();
			$(this.inputBox).on("input", function() { _this.textChanged() });
		}
		
		SearchOptionsView.call(this, containerNode, fill, chunkerType);
		if (containerNode)
		{
			/* Call setupInputBox at the end because it may trigger an input event. */
			this.setupInputBox();
		}
	}
	
	SearchView.prototype.setupInputBox = function()
	{
		/* Do nothing by default */
	}
	
	SearchView.prototype.inputText = function(val)
	{
		if (val === undefined)
			return this.inputBox.value.trim();
		else
		{
			this.inputBox.value = val;
			$(this.inputBox).trigger("input");
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
	PanelSearchView.prototype = new SearchView();
	PanelSearchView.prototype.sitePanel = undefined
	
	function PanelSearchView(sitePanel, placeholder, fill, chunkerType) {
		if (sitePanel)
		{
			/* Set sitePanel first for call to appendSearchArea */
			this.sitePanel = sitePanel;
			SearchView.call(this, sitePanel.node(), placeholder, fill, chunkerType);
			
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
		return this.sitePanel.appendScrollArea()
			.append('ol');
	}
	
	return PanelSearchView;
})();

/* A div that can be shown or hidden to the right. */
var HidableDiv = (function()
{
	HidableDiv.prototype._width = null;
	HidableDiv.prototype.duration = 400;
	HidableDiv.prototype.$div = null;
	
	HidableDiv.prototype.show = function(done, duration)
	{
		duration = duration !== undefined ? duration : this.duration;
		
		this.$div.css('display', '');
		this.$div.animate({left: 0, width: this._width}, duration, done);
	}
	
	HidableDiv.prototype.hide = function(done)
	{
		return this.$div.animate({left: this._width, width: 0}, this.duration, function()
			{
				$(this).css('display', 'none');
				done();
			})
			.promise();
	}
	
	HidableDiv.prototype.height = function(newHeight)
	{
		return (newHeight === undefined) ? this.$div.height() : this.$div.height(newHeight); 
	}
	
	HidableDiv.prototype.isVisible = function()
	{
		return this.$div.css('display') != 'none';
	}
	
	HidableDiv.prototype.value = function(newValue)
	{
		if (newValue === undefined)
		{
			return this.$div.text();
		}
		else
		{
			this.$div.text(newValue);
			this.$div.width('auto');
			this._width = this.$div.width();
			return this;
		}
	}
	
	function HidableDiv(div, startDisplay, duration)
	{
		if (div)
		{
			var _this = this;
			startDisplay = startDisplay !== undefined ? startDisplay : '';
			duration = duration !== undefined ? duration : 400;
		
			this.$div = $(div);
			this.duration = duration;
			_this.$div.css('display', startDisplay);
		
			setTimeout(function()
				{
					if (_this.$div.width())
						_this._width = _this.$div.width();
					if (startDisplay === 'none')
						_this.$div.width(0);
				}, 0);
		}
	}
	
	return HidableDiv;
})();

/* A chevron that can be shown or hidden to the right. */
var HidingChevron = (function () {
	HidingChevron.prototype = new HidableDiv();
	
	function HidingChevron(itemDiv, doneHide)
	{
		var _this = this;
		var endDateChevron = appendRightChevrons(itemDiv);
		
		HidableDiv.call(this, endDateChevron.node(), 'none', 200);
		this._width = this.$div.height();
		
		endDateChevron.on('click', function()
			{
				if (prepareClick('click', 'end date chevron'))
				{
					_this.hide(doneHide);
				}
			});
	}
	
	return HidingChevron;
})();

var CellToggleText = (function()
{
	CellToggleText.prototype.span = null;
	
	CellToggleText.prototype.enable = function()
	{
		this.span.classed('site-active-text', true)
			.classed('site-disabled-text', false);
	}
	
	CellToggleText.prototype.disable = function()
	{
		this.span.classed('site-active-text', false)
			.classed('site-disabled-text', true);
	}
	
	function CellToggleText(container, text, onClick)
	{
		this.span = container.append('span')
			.classed('in-cell-button site-active-text', true)
			.on('click', onClick)
			.text(text);
	}
	
	return CellToggleText;
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

/* Gets the text for the header of a view panel based on the specified data. */
function getViewPanelHeader(objectData)
{
	var headerText = objectData.getDescription();
	if (!objectData.hasTextDescription())
	{
		if (headerText.length > 0)
			headerText = objectData.cell.field.name + " (" + headerText + ")";
		else
			headerText = objectData.cell.field.name;
	}
	return headerText;
}

function revealPanelLeft(panelDiv)
{
	panelDiv.sitePanel.showLeft().always(unblockClick);
}

function revealPanelUp(panelDiv)
{
	return panelDiv.sitePanel.showUp()
		.always(unblockClick);
}

/* Displays a panel in which the specified object's contents appear without being able to edit.
 */
function showViewOnlyObjectPanel(objectData, backText) {
	objectData.promiseCells()
		.then(function ()
			{
				var sitePanel = new SitePanel();
				sitePanel.createRoot(objectData, getViewPanelHeader(objectData), "view");

				var navContainer = sitePanel.appendNavContainer();

				var backButton = navContainer.appendLeftButton()
					.on("click", function() { sitePanel.hideRightEvent(); });
				appendLeftChevrons(backButton).classed("site-active-text", true);
				backButton.append("div").text(" " + backText);
	
				var panel2Div = sitePanel.appendScrollArea();

				var headerDiv = panel2Div.appendHeader();

				sitePanel.showLeft().then(unblockClick);
	
				panel2Div.append("div").classed("cell-border-below", true);
				sitePanel.showViewCells(objectData.getCells());
			}, 
			cr.syncFail)
}

/* Displays a panel in which the specified object's contents appear.
 */
function showViewObjectPanel(cell, objectData, backText, showFunction) {
	objectData.promiseCells()
		.then(function ()
			{
				var sitePanel = new SitePanel();
				var header = getViewPanelHeader(objectData);
				sitePanel.createRoot(objectData, header, "view", showFunction);

				var navContainer = sitePanel.appendNavContainer();

				var backButton = navContainer.appendLeftButton()
					.on("click", function() { sitePanel.hideRightEvent(); });
				appendLeftChevrons(backButton).classed("site-active-text", true);
				backButton.append("div").text(" " + backText);
	
				if (objectData.canWrite())
				{
					var editButton = navContainer.appendRightButton()
						.on("click", function(d) {
							if (prepareClick('click', 'view object panel: Edit'))
							{
								showClickFeedback(this);
				
								showEditObjectPanel(cell, objectData, header, revealPanelUp);
							}
							d3.event.preventDefault();
						});
					editButton.append("span").text("Edit");
				}
	
				var panel2Div = sitePanel.appendScrollArea();

				var headerDiv = panel2Div.appendHeader();
		
				var updateHeader = function(eventObject)
				{
					var newText = getViewPanelHeader(this);
					sitePanel.panelDiv.attr("headerText", newText);
					d3.select(eventObject.data).text(newText);
				}
				objectData.on("dataChanged.cr", headerDiv.node(), updateHeader);
				$(headerDiv.node()).on("remove", null, objectData, function(eventObject)
				{
					eventObject.data.off("dataChanged.cr", updateHeader);
				});

				panel2Div.append("div").classed("cell-border-below", true);
				sitePanel.showViewCells(objectData.getCells());
		
				showFunction(sitePanel.node());
			}, 
			cr.syncFail)
}

function _b64_to_utf8( str ) {
    str = str.replace(/\s/g, '');    
    return decodeURIComponent(escape(window.atob( str )));
}

function promiseImportCells(containerCell, d, cells)
{
	if (d == null)
		d = containerCell.addNewValue();
		
	d.importCells(cells);

	d.calculateDescription();
	d.triggerDataChanged();

	var promise = $.Deferred();
	promise.resolve(d);
	return promise;
}

function promiseSaveCells(containerCell, d, cells)
{
	var initialData = {}
	cells.forEach(
		function(cell) {
			cell.appendData(initialData);
		});

	return d.saveNew(initialData);
}

function promiseCreateObjectFromCells(containerCell, objectData, cells)
{
	var initialData = {}
	cells.forEach(
		function(cell) {
			cell.appendData(initialData);
		});

	/* Test case: add a new service to the services panel. */
	return $.when(cr.createInstance(containerCell.field, 
						  containerCell.parent && containerCell.parent.getInstanceID(), 
						  initialData))
				   .then(function(newData)
						  {
							containerCell.addValue(newData);
						  });
}

var EditPanel = (function() {
	EditPanel.prototype = new SitePanel();
	EditPanel.prototype.navContainer = null;
	
	EditPanel.prototype.appendBackButton = function()
	{
		var _this = this;
		var backButton = this.navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'edit object panel: Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
	}
	
	EditPanel.prototype.appendAddButton = function(promise, containerCell, objectData, cells)
	{
		var doneButton;
		var _this = this;
		doneButton = this.navContainer.appendRightButton();
		doneButton.on("click", function(d) {
			if (prepareClick('click', 'EditPanel done'))
			{
				showClickFeedback(this);
			
				try
				{
					var sections = _this.mainDiv.selectAll("section");
					sections.each(
						function(cell) {
							cell.updateCell(this);
						});
						
					$.when(promise(containerCell, objectData, sections.data()))
					 .then(function() {
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
		doneButton.append("span").text("Add");
		return doneButton;
	}
	
	function EditPanel(objectData, cells, header, onShow)
	{
		this.createRoot(objectData, header, "edit", onShow);
		this.navContainer = this.appendNavContainer();

		var panel2Div = this.appendScrollArea();
		this.showEditCells(cells);

		$(this.node()).on('dragover',
			function(e) {
				e.preventDefault();
				e.stopPropagation();
			}
		)
		$(this.node()).on('dragenter',
			function(e) {
				e.preventDefault();
				e.stopPropagation();
			}
		)
		$(this.node()).on('drop', function(e)
		{
			if (e.originalEvent.dataTransfer) {
				if (e.originalEvent.dataTransfer.files.length) {
					e.preventDefault();
					e.stopPropagation();
					jQuery.each( e.originalEvent.dataTransfer.files, function(index, file){
							var fileReader = new FileReader();
								fileReader.onload = function(e) {
									 if (e.target.result.startsWith("data:application/json") &&
									 	 e.target.result.indexOf("base64,") > 0)
									 {
									 	var start = e.target.result.indexOf("base64,") + "base64,".length;
									 	var s = e.target.result.substring(start);
									 	try
									 	{
									 		var data = JSON.parse(_b64_to_utf8(s));
									 		for (var j = 0; j < data.length; ++j)
									 		{
									 			var d = data[j];
									 			for (var name in d)
									 			{
													for (var i = 0; i < cells.length; ++i)
													{
														var cell = cells[i];
														if (cell.field.name === name)
														{
															if (objectData && objectData.getInstanceID())
															{
																$.when(cr.createInstance(cell.field, objectData.getInstanceID(), d[name]))
																 .then(function(newData)
																	{
																		cell.addValue(newData);
																	},
																	cr.asyncFail);
															}
															else
															{
																/* In this case, we are dropping onto an item that hasn't been saved. */
																throw new Error("drop not supported for new items");
															}
															break;
														}
													}
												}
											}
									 	}
									 	catch(err)
									 	{
									 		bootstrap_alert.warning(err.message, '.alert-container');
									 	}
									 }
								};
							fileReader.readAsDataURL(file);
						  });
				} 
			}  
		});
	}
	
	return EditPanel;
})();

/* 
	Displays a panel for editing the specified object. 
 */
function showEditObjectPanel(containerCell, objectData, backText, onShow, getSavePromise) {
	var successFunction = function(cells)
	{
		var header;
		if (objectData && objectData.getInstanceID())
			header = "Edit";
		else
			header = "New " + containerCell.field.name;
		var sitePanel = new EditPanel(objectData, cells, header, onShow);

		var doneButton;
		if (objectData && objectData.getInstanceID())
		{
			if (onShow === revealPanelUp)
				doneButton = sitePanel.navContainer.appendRightButton();
			else
				doneButton = sitePanel.navContainer.appendLeftButton();
			doneButton.append("span").text("Done");
			doneButton.on("click", function()
				{
					sitePanel.mainDiv.handleDoneEditingButton.call(this);
				});
		}
		else
		{
			var sections = sitePanel.mainDiv.selectAll('section');
			var f = null;
			
			if (getSavePromise)
				f = getSavePromise;
			else if (objectData)
			{
				/* Test case: Set the address for a site where the site
				   has been previously saved without an address. */
				f = promiseSaveCells;
			}
			else
			{
				/* Test case: add a new service to the services panel. */
				f = promiseCreateObjectFromCells;
			}
			
			var doneButton = sitePanel.appendAddButton(f, containerCell, objectData, sections.data());
			
			sitePanel.appendBackButton();
		}
		sitePanel.navContainer.appendTitle(header);
		
		onShow(sitePanel.node());
	}
	
	if (objectData && (objectData.getInstanceID() || objectData.getCells()))
		objectData.promiseCells()
			.then(function()
				{
					successFunction(objectData.getCells());
				}, cr.syncFail);
	else
		/* Test case: Add a new site to an organization. */
		containerCell.getConfiguration()
			.then(successFunction, cr.syncFail);
}

/* 
	Displays a panel for adding a root object. 
 */
function showAddRootPanel(containerCell, onShow) {
	var successFunction = function(cells)
	{
		var header = "New " + containerCell.field.name;
			
		var sitePanel = new EditPanel(null, cells, header, onShow);

		var doneButton = sitePanel.appendAddButton(promiseCreateObjectFromCells, containerCell, null, cells);
		
		sitePanel.appendBackButton();

		sitePanel.navContainer.appendTitle(header);
		
		onShow(sitePanel.node());
	}
	
	/* Test case: Display panel to add a new term. */
	containerCell.getConfiguration()
			.then(successFunction, cr.syncFail);
}

function getViewRootObjectsFunction(cell, header, sortFunction, successFunction)
{
	return function(rootObjects)
	{
		if (sortFunction)
			rootObjects.sort(sortFunction);
			
		for (var i = 0; i < rootObjects.length; i++)
			cell.pushValue(rootObjects[i]);
		
		var sitePanel = new SitePanel();
		sitePanel.createRoot(cell, header, "list");

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function() { sitePanel.hideRightEvent(); });
		backButton.append("span").text("Done");
		
		var checkEdit = function()
		{
			if (cr.signedinUser.getValue("_system access"))
			{
				var editButton = navContainer.appendRightButton()
					.on("click", function(d) {
						if (prepareClick('click', 'view roots object panel: Edit'))
						{
							showClickFeedback(this);
				
							showEditRootObjectsPanel(cell, "Edit " + header, sortFunction);
						}
						d3.event.preventDefault();
					});
				editButton.append("span").text("Edit");
			}
			navContainer.appendTitle(header);
		}
		
		if (cr.signedinUser.getCells())
			checkEdit();
		else
		{
			cr.signedinUser.on("signin.cr", navContainer.nav.node(), checkEdit);
			$(navContainer.nav.node()).on("remove", null, cr.signedinUser, function(eventObject)
				{
					eventObject.data.off("signin.cr", checkEdit);
				});
		}
				
		function textChanged(){
			var val = this.value.toLocaleLowerCase();
			if (val.length === 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return "none";
						});
			}
		}
	
		sitePanel.appendSearchBar(textChanged);

		var panel2Div = sitePanel.appendScrollArea();
		
		var itemsDiv = panel2Div.append("section")
			.classed("multiple", true)
			.append("ol")
			.classed("border-above", true)
			.datum(cell);
		

		var addedFunction = getOnValueAddedFunction(false, true, showViewObjectPanel);
		var addedFunctionWithSort = function(eventObject, newValue)
		{
			addedFunction.call(this, eventObject, newValue);
			if (sortFunction)
			{
				itemsDiv.selectAll("li").sort(sortFunction);
				cell.data.sort(sortFunction);
			}
		}
		
		var dataChangedFunction = function(eventObject, newData)
		{
			if (sortFunction)
			{
				itemsDiv.selectAll("li").sort(sortFunction);
				cell.data.sort(sortFunction);
			}
		}

		cell.on("valueAdded.cr", itemsDiv.node(), addedFunctionWithSort);
		cell.on("dataChanged.cr", itemsDiv.node(), dataChangedFunction);
		$(itemsDiv.node()).on("remove", null, this, function(eventObject)
			{
				eventObject.data.off("valueAdded.cr", addedFunctionWithSort);
				eventObject.data.off("dataChanged.cr", dataChangedFunction);
			});
	
		appendViewCellItems(itemsDiv, cell, 
			function(d) {
				if (prepareClick('click', 'view root object: ' + d.getDescription()))
				{
					showViewObjectPanel(cell, d, sitePanel.node().getAttribute("headerText"), revealPanelLeft);
				}
			});

		_setupItemsDivHandlers(itemsDiv, cell);
		if (successFunction)
			successFunction(sitePanel.node());
	}
}

function showEditRootObjectsPanel(cell, header, sortFunction)
{
	var sitePanel = new SitePanel();
	sitePanel.createRoot(cell, header, "list");

	var navContainer = sitePanel.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", function()
		{
			sitePanel.handleCloseDownEvent();
		});
	backButton.append("span").text("Done");
	
	var addButton = navContainer.appendRightButton()
		.classed("add-button", true)
		.on("click", function(d) {
			if (prepareClick('click', 'edit root objects: add'))
			{
				try
				{
					showClickFeedback(this);
					showAddRootPanel(cell, revealPanelUp);
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
			d3.event.preventDefault();
		});
	addButton.append("span").text("+");
	navContainer.appendTitle(header);	
	
	var textChanged = function(){
		var val = this.value.toLocaleLowerCase();
		if (val.length === 0)
		{
			/* Show all of the items. */
			panel2Div.selectAll("li")
				.style("display", null);
		}
		else
		{
			/* Show the items whose description is this.value */
			panel2Div.selectAll("li")
				.style("display", function(d)
					{
						if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
							return null;
						else
							return "none";
					});
		}
	}

	sitePanel.appendSearchBar(textChanged);

	var panel2Div = sitePanel.appendScrollArea();
	
	var itemsDiv = panel2Div.append("section")
		.classed("multiple", true)
		.append("ol")
		.classed("border-above", true)
		.datum(cell);
	
	var addedFunction = getOnValueAddedFunction(true, true, showEditObjectPanel);
	var addedFunctionWithSort = function(eventObject, newValue)
	{
		addedFunction.call(this, eventObject, newValue);
		if (sortFunction)
			itemsDiv.selectAll("li").sort(sortFunction);
	}
	
	var dataChangedFunction = function(eventObject, newData)
	{
		if (sortFunction)
			itemsDiv.selectAll("li").sort(sortFunction);
	}

	cell.on("valueAdded.cr", itemsDiv.node(), addedFunctionWithSort);
	cell.on("dataChanged.cr", itemsDiv.node(), dataChangedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			eventObject.data.off("valueAdded.cr", addedFunctionWithSort);
			eventObject.data.off("dataChanged.cr", dataChangedFunction);
		});

	appendEditCellItems(itemsDiv, cell, 
		function(d) {
			if (prepareClick('click', 'edit cell item: ' + d.getDescription()))
			{
				showEditObjectPanel(cell, d, header, revealPanelLeft);
			}
		});
	_setupItemsDivHandlers(itemsDiv, cell);

	$(sitePanel.node()).on('dragover',
		function(e) {
			e.preventDefault();
			e.stopPropagation();
		}
	)
	$(sitePanel.node()).on('dragenter',
		function(e) {
			e.preventDefault();
			e.stopPropagation();
		}
	)
	$(sitePanel.node()).on('drop', function(e)
	{
		if (e.originalEvent.dataTransfer) {
			if (e.originalEvent.dataTransfer.files.length) {
				e.preventDefault();
				e.stopPropagation();
				jQuery.each( e.originalEvent.dataTransfer.files, function(index, file){
						var fileReader = new FileReader();
							fileReader.onload = function(e) {
								 if (e.target.result.startsWith("data:application/json") &&
									 e.target.result.indexOf("base64,") > 0)
								 {
									var start = e.target.result.indexOf("base64,") + "base64,".length;
									var s = e.target.result.substring(start);
									try
									{
										var data = JSON.parse(_b64_to_utf8(s));
										for (var j = 0; j < data.length; ++j)
										{
											var d = data[j];
											$.when(cr.createInstance(cell.field, null, d))
											 .then(function(newData)
												{
													cell.addValue(newData);
												},
												cr.asyncFail);
										}
									}
									catch(err)
									{
										bootstrap_alert.warning(err.message, '.alert-container');
									}
								 }
							};
						fileReader.readAsDataURL(file);
					  });
			} 
		}  
	});
	
	sitePanel.showUp().always(unblockClick);
}

/* Displays a panel from which a user can select an object of the kind required 
	for objects in the specified cell.
 */
function showPickObjectPanel(cell, oldData) {
	var failFunction = syncFailFunction;
	
	function selectAllSuccessFunction(rootObjects) {
		if (!("pickObjectPath" in cell.field && cell.field.pickObjectPath))
		{
			rootObjects.sort(function(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				});
		}
	
		var panelDatum;
		if (oldData && oldData.id)
			panelDatum = oldData;	/* Replacing an existing object. */
		else
			panelDatum = cell;		/* Adding a new object. */
		var sitePanel = new SitePanel();
		sitePanel.createRoot(panelDatum, cell.field.name, "list");

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'pick object panel: Cancel'))
				{
					sitePanel.hideRight(unblockClick);
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
		
		navContainer.appendTitle(cell.field.name);

		var textChanged = function(){
			var val = this.value.toLocaleLowerCase();
			if (val.length === 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return "none";
						});
			}
		}
	
		sitePanel.appendSearchBar(textChanged);

		var panel2Div = sitePanel.appendScrollArea();
		
		function buttonClicked(d) {
			/* d is the ObjectValue that the user clicked. */
			var successFunction = function()
			{
				sitePanel.hideRight(unblockClick);
			}
			
			if (prepareClick('click', 'pick object panel: ' + d.getDescription()))
			{
				try
				{
					if (!oldData)
					{
						/* Test case: Add an item to a cell that can contain multiple items. 
						 */
						if (cell.parent && cell.parent.getInstanceID())	/* In this case, we are adding an object to an existing object. */
						{
							/* Test case: Add a service to an offering that has been saved. 
						 	 */
							cr.updateValues([cell.getAddCommand(d)], [cell])
								.then(successFunction, cr.syncFail);
						}
						else 
						{
							oldData = cell.addNewValue();
							
							/* In this case, we are replacing an old value for
							   an item that was added to the cell but not saved;
							   a placeholder or a previously picked value.
							 */
							oldData.updateFromChangeData({instanceID: d.getInstanceID(), description: d.getDescription()});
							oldData.triggerDataChanged();
							successFunction();
						}
					}
					else if (d.getInstanceID() === oldData.getInstanceID()) {
						/* Test case: Choose the same item as was previously selected for this item. */
						successFunction();
					}
					else if (oldData.id)
					{
						if (d.getInstanceID())
						{
							/* Test case: Choose a different item as was previously selected for this item. */
							cr.updateObjectValue(oldData, d, -1, successFunction, cr.syncFail);
						}
						else
						{
							/* Test case: Choose none for a unique item that was previously specified. */
							oldData.deleteValue(successFunction, cr.syncFail);
						}
					}
					else if (d.getInstanceID())
					{
						/* Test case: Set the value of a unique item in a cell where the current value is None.
						 */
						if (cell.parent && cell.parent.getInstanceID())	/* In this case, we are adding an object to an existing object. */
						{
							/* Test case: Set the state of an address that was previously saved without a state. 
						 	 */
							cr.updateValues([cell.getAddCommand(d)], [oldData])
								.then(successFunction, cr.syncFail);
						}
						else 
						{
							/* In this case, we are replacing an old value for
							   an item that was added to the cell but not saved;
							   a placeholder or a previously picked value.
							 */
							oldData.updateFromChangeData({instanceID: d.getInstanceID(), description: d.getDescription()});
							oldData.triggerDataChanged();
							successFunction();
						}
					}
					else
						successFunction();
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
			d3.event.preventDefault();
		}
		
		if (cell.isUnique())
		{
			var nullObjectValue = new cr.ObjectValue();
			rootObjects = [nullObjectValue].concat(rootObjects);
		}
		var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
		
		if (oldData)
		{
			buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return d.getDescription() == oldData.getDescription(); });
		}
	
		sitePanel.showLeft().then(unblockClick);
	}
	
	if (cell.field.pickObjectPath)
	{
		var pickObjectPath = cell.field.pickObjectPath;
		if (pickObjectPath.indexOf("parent") === 0 &&
			">:=<".indexOf(pickObjectPath.charAt(6)) >= 0)
		{
			var currentObject = cell.parent;
			pickObjectPath = pickObjectPath.slice(6);
			while (currentObject != null &&
				   pickObjectPath.indexOf("::reference(") === 0 &&
				   !currentObject.getInstanceID())
			{
				currentObject = currentObject.cell.parent;
				pickObjectPath = pickObjectPath.slice("::reference(".length);
				/* While the next string is quoted, skip it. */
				while (pickObjectPath[0] === '"')
				{
					pickObjectPath = pickObjectPath.slice(1);
					pickObjectPath = pickObjectPath.slice(pickObjectPath.indexOf('"')+1);
				}
				/* Skip over the next close parenthesis */
				pickObjectPath = pickObjectPath.slice(pickObjectPath.indexOf(')')+1);
			}
			if (currentObject != null && currentObject.getInstanceID())
			{
				/* Test case: edit the inquiry access group of an organization */
				pickObjectPath = "#"+currentObject.getInstanceID()+pickObjectPath;
				cr.selectAll({path: pickObjectPath})
					.then(selectAllSuccessFunction, cr.syncFail);
			}
			else
				cr.syncFail("The container has not yet been saved.");
		}
		else
			/* Test case: edit the public access of an organization. */
			cr.selectAll({path: pickObjectPath})
				.then(selectAllSuccessFunction, cr.syncFail);
	}
	else
		/* Test case: edit the name of a field of a configuration of a term. */
		cr.selectAll({path: cell.field.ofKindID})
			.then(selectAllSuccessFunction, cr.syncFail);
}
		
