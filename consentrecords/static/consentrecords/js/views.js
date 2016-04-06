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

$.fn.calculateFillHeight = function()
{
	var parent = this.parent();
	var n = this.get(0);
	newHeight = parent.children().toArray().reduce(function(h, childNode) {
			var child = $(childNode);
			if (child.css("display") != "none" && 
				child.css("position") != "absolute" &&
				childNode != n)
				return h - child.outerHeight(true);
			else
				return h;
		},
		parseInt(parent.height()));
	this.css("height", "{0}px".format(newHeight));
	this.one("resize.cr", function(eventObject)
		{
			eventObject.stopPropagation();
		});
	this.trigger("resize.cr");
};

/* A utility function for formatting strings like printf */
String.prototype.format = function () {
  var args = arguments;
  return this.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
    if (m == "{{") { return "{"; }
    if (m == "}}") { return "}"; }
    return args[n];
  });
};

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
					var newValue = cell.addNewValue();
					
					if (done)
						done(newValue);
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add " + cell.field.name);
	},
};

function syncFailFunction(error)
{
	cr.logRecord('fail', error);
	bootstrap_alert.warning(error, ".alert-container");
	unblockClick();
}

/* A default function used to report an error during an asynchronous operation
	without unblocking a user event. */
function asyncFailFunction(error)
{
	cr.logRecord('async fail', error);
	bootstrap_alert.warning(error, ".alert-container");
	/* Don't unblock here, because there was no block. */
}
		
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

function prepareClick(name, message, forceCloseAlert)
{
	forceCloseAlert = (forceCloseAlert !== undefined ? forceCloseAlert : true);
	if (_isClickBlocked())
	{
		if (name)
			cr.logRecord(name + ' blocked', message);
		return false;
	}
	if (forceCloseAlert)
		closealert();
		
	_blockClick();
	if (name)
		cr.logRecord(name, message);
	return true;
}
 
function showClickFeedback(obj)
{
	var oldOpacity = $(obj).css("opacity");
	$(obj).animate({opacity: "0.2"}, 200)
		   .animate({opacity: oldOpacity}, 600, "swing",
		   	function() {
		   		$(obj).css("opacity", "");
		   	});
}

function showPanelUp(panelNode, done)
{
	window.scrollTo(0, 0);
	$(panelNode).hide("slide", {direction: "down"}, 0);
	$(panelNode).css("display", "block")
				.trigger("revealing.cr");
	$(window).trigger("resize");
	$(panelNode).effect("slide", {direction: "down"}, 400, function() {
							if (done)
								done();
						});
}

function showPanelNow(panelNode)
{
	$(panelNode).offset({top: 0, left: 0})
				.css("display", "block")
				.trigger("revealing.cr");
	$(window).trigger("resize");
}

function showPanelLeft(panelNode, done)
{
	window.scrollTo(0, 0);
	$(panelNode).hide("slide", {direction: "right"}, 0);
	$(panelNode).css("display", "block")
				.trigger("revealing.cr");
	$(window).trigger("resize");
	$(panelNode).effect("slide", {direction: "right"}, 400, function() {
							if (done)
								done();
						});
}

function asyncHidePanelRight(panelNode, doRemove, completeFunction)
{
	doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
	closealert();
	$(panelNode).trigger("hiding.cr");
	$(panelNode).hide("slide", {direction: "right"}, 400, 
		function() {
			if (doRemove)
				$(this).remove();
			if (completeFunction)
				completeFunction();
		});
}

function hidePanelRight(panelNode, doRemove, completeFunction)
{
	doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
	closealert();
	$(panelNode).trigger("hiding.cr");
	$(panelNode).hide("slide", {direction: "right"}, 400, 
		function() {
			if (doRemove)
				$(this).remove();
			unblockClick();
			if (completeFunction)
				completeFunction();
		});
}
		
function handleCloseRightEvent() {
	if (prepareClick('click', 'Close Right'))
		hidePanelRight($(this).parents(".site-panel")[0]);
	else
		cr.logRecord('click', 'Close Right blocked');
	d3.event.preventDefault();
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
	
	$(d).on("dataChanged.cr", null, this, f);
	$(this).on("remove", null, d, function(eventObjects) {
		$(this.eventObject).off("dataChanged.cr", null, f);
	});
	
	if (d.cell && d.cell.isUnique())
	{
		$(d).on("valueDeleted.cr", null, this, f);
		$(this).on("remove", null, d, function(eventObjects) {
			$(this.eventObject).off("valueDeleted.cr", null, f);
		});
	}
}

function _getDataValue(d) { return d.text; }
function _getDataDescription(d) { return d.getDescription() }

function _checkItemsDivDisplay(node)
{
	var classList = node.parentNode.classList;
	var isUnique = classList.contains("unique");
	var isEdit = classList.contains("edit");
	
	var itemsDiv = d3.select(node);
	var items = itemsDiv.selectAll("li");
	
	if (isEdit)
		isVisible = items.size() > 0;
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
	d3.select(itemsDiv.node().parentNode).style("display", (isEdit || isVisible) ? null : "none");
}

function _setupItemsDivHandlers(itemsDiv, cell)
{
	node = itemsDiv.node();
	function checkVisible(eventObject)
	{
		_checkItemsDivDisplay(eventObject.data, this);
	}
	$(cell).on("dataChanged.cr", null, node, checkVisible);
	$(node).on("remove", null, cell, function(eventObject)
	{
		$(eventObject.data).off("dataChanged.cr", null, checkVisible);
	});
	_checkItemsDivDisplay(node, cell);
}

function removeItem(itemNode, done)
{
	$(itemNode).animate({height: "0px"}, 400, 'swing', function()
	{
		var parentNode = this.parentNode;
		$(this).remove();
		/* Now that the item is removed, check whether its container should be visible. */
		_checkItemsDivDisplay(parentNode);
		if (done) done();
	});
}

function _setupItemHandlers(d)
{
	/* This method may be called for a set of items that were gotten directly and are not
		part of a cell. Therefore, we have to test whether d.cell is not null.
	 */
	if ($(this).parents(".multiple").length > 0)
	{
		var f = function(eventObject)
		{
			removeItem(eventObject.data);
		}
		$(d).one("valueDeleted.cr", null, this, f);
		$(this).on("remove", this, d, function(eventObject)
		{
			$(eventObject.data).off("valueDeleted.cr", null, f);
		});
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
	$(cell).on("valueAdded.cr", null, itemsDiv.node(), addedValue);
	$(itemsDiv.node()).on("remove", null, cell, function(eventObject)
		{
			$(eventObject.data).off("valueAdded.cr", null, addedValue);
		});
	
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
	
		divs.append("input")
			.attr("type", inputType)
			.attr("placeholder", cell.field.name)
			.property("value", _getDataValue);

		if (cell.field.descriptorType != "_by text")
		{
			var labelDiv = sectionObj.insert("label", ":first-child")
				.text(cell.field.name);
			labelDiv
				.style("line-height", divs.selectAll("input").style("line-height"));
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
		$(cell).on("valueAdded.cr", null, itemsDiv.node(), appendNewValue);
		$(itemsDiv.node()).on("remove", null, cell, function(eventObject)
			{
				$(eventObject.data).off("valueAdded.cr", null, appendNewValue);
			});
		_setupItemsDivHandlers(itemsDiv, cell);
			
		crv.appendAddButton(sectionObj, unblockClick);
	}
}

function _showEditDateStampDayOptionalCell(obj, panelDiv)
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
				.text(this.field.name);
			labelDiv
				.style("line-height", divs.selectAll(".date-row").style("line-height"));
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
		$(this).on("valueAdded.cr", null, itemsDiv.node(), appendNewValue);
		$(itemsDiv.node()).on("remove", null, this, function(eventObject)
			{
				$(eventObject.data).off("valueAdded.cr", null, appendNewValue);
			});
		_setupItemsDivHandlers(itemsDiv, this);
			
		crv.appendAddButton(sectionObj, unblockClick);
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
				.text(cell.field.name);
			labelDiv
				.style("line-height", divs.selectAll("input").style("line-height"));
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
		$(cell).on("valueAdded.cr", null, itemsDiv.node(), appendNewValue);
		$(itemsDiv.node()).on("remove", null, cell, function(eventObject)
			{
				$(eventObject.data).off("valueAdded.cr", null, appendNewValue);
			});
		_setupItemsDivHandlers(itemsDiv, cell);
			
		crv.appendAddButton(sectionObj, unblockClick);
	}
}

/* Produces a function which adds new value view to a container view
	when the new data is added.
	the viewFunction is called when the item is clicked.
 */
function getOnValueAddedFunction(canDelete, canShowDetails, viewFunction)
{
	return function(eventObject, newValue)
	{
		var cell = this;
		var itemsDiv = d3.select(eventObject.data);
		
		var previousPanelNode = $(eventObject.data).parents(".site-panel")[0];
		var item = appendItem(itemsDiv, newValue);
		_checkItemsDivDisplay(eventObject.data);
		
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
			$(newValue).on("dataChanged.cr", null, item.node(), checkVisible);
			$(item.node()).on("remove", null, newValue, function(eventObject)
			{
				$(eventObject.data).off("dataChanged.cr", null, checkVisible);
			});
		}

		if (canDelete && !cell.isUnique())
			appendConfirmDeleteControls(item);
		
		var buttons = appendRowButtons(item);

		buttons.on("click", function(d) {
			if (prepareClick('click', 'view added item: ' + d.getDescription()))
			{
				viewFunction(d, previousPanelNode, revealPanelLeft);
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
				400);
		})
		.on('click', onClick);
}

function appendDeleteControls(buttons)
{
	buttons.append("button")
		.classed("glyphicon glyphicon-minus-sign pull-left", true)
		.on("click", function(e)
		{
			if (prepareClick('click', 'delete button'))
			{
				$(this).animateRotate(90, 180, 600, 'swing');
				var confirmButton = $($(this).parents("li")[0]).children("button");
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
	buttons.append("div")
		.classed("site-chevron-right right-fixed-width-div right-vertical-chevron", true)
		.append("img")
		.attr("src", rightChevronPath)
		.attr("height", "18px");
}

function appendLeftChevrons(buttons)
{
	return buttons.append("div")
		.classed("site-left-chevron-span", true)
		.append("img")
		.classed("site-left-chevron", true)
		.attr("src", leftChevronPath);
}

/* This function appends the descriptions of each object to the button. */
function appendButtonDescriptions(buttons)
{
	return buttons.append("div")
		.classed("description-text string-value-view", true)
		.text(_getDataDescription);
}

function _clickEditObjectValue(d, previousPanelNode)
{
	if (_isPickCell(d.cell))
	{
		if (prepareClick('click', 'pick object: ' + d.getDescription()))
			showPickObjectPanel(d, previousPanelNode);
	}
	else
	{
		if (prepareClick('click', 'edit object: ' + d.getDescription()))
			showEditObjectPanel(d, previousPanelNode, revealPanelLeft);
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
	d3.select(sectionObj).selectAll(".string-input-container").each(function(d, i)
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
	console.log(sel.options[sel.selectedIndex].value)
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
	d3.select(sectionObj).selectAll(".string-input-container").each(function(d)
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
		.text(this.field.label ? this.field.label : this.field.name);
}

cr.StringCell.prototype.appendUpdateCommands = _appendUpdateStringCommands;
cr.StringCell.prototype.updateCell = _updateStringCell;
cr.StringCell.prototype.show = function(obj, containerPanel)
{
	_showViewStringCell(obj, this);
}
cr.StringCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "text");
}

cr.NumberCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "number");
}

cr.EmailCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "email");
}

cr.UrlCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "url");
}

cr.TelephoneCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "tel");
}

cr.DatestampCell.prototype.appendUpdateCommands = _appendUpdateDatestampCommands;
cr.DatestampCell.prototype.updateCell = _updateDatestampCell;
cr.DatestampCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "date");
}

cr.DatestampDayOptionalCell.prototype.appendUpdateCommands = _appendUpdateDatestampDayOptionalCommands;
cr.DatestampDayOptionalCell.prototype.updateCell = _updateDatestampDayOptionalCell;
cr.DatestampDayOptionalCell.prototype.showEdit = _showEditDateStampDayOptionalCell;

cr.TimeCell.prototype.appendUpdateCommands = _appendUpdateTimeCommands;
cr.TimeCell.prototype.updateCell = _updateTimeCell;
cr.TimeCell.prototype.showEdit = function(obj, containerPanel)
{
	_showEditStringCell(obj, this, "time");
}

cr.TranslationCell.prototype.appendUpdateCommands = _appendUpdateTranslationCommands;
cr.TranslationCell.prototype.updateCell = _updateTranslationCell;
cr.TranslationCell.prototype.showEdit = function(obj, containerPanel)
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
			else if ("cells" in d)
			{
				/* This case is true if we are creating an object */
				var subData = {}
				$(d.cells).each(function()
				{
					this.appendData(subData);
				});
				{
					var command;
					command = {containerUUID: d.cell.parent.getValueID(), 
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

cr.ObjectCell.prototype.show = function(obj, previousPanelNode)
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
					showViewObjectPanel(cell.data[0], previousPanelNode, revealPanelLeft);
				}
			});
	}
	
	var addedFunction = getOnValueAddedFunction(false, !_isPickCell(this), showViewObjectPanel);

	$(this).on("valueAdded.cr", null, itemsDiv.node(), addedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			$(eventObject.data).off("valueAdded.cr", null, addedFunction);
		});
	
	var clickFunction;
	if (_isPickCell(this) || this.isUnique())	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
			if (prepareClick('click', 'view multiple ' + d.cell.field.name + ': ' + d.getDescription()))
			{
				showViewObjectPanel(d, previousPanelNode, revealPanelLeft);
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

cr.ObjectCell.prototype.showEdit = function(obj, previousPanelNode)
{
	var sectionObj = d3.select(obj);
	
	var labelDiv = this.appendLabel(obj);
	var itemsDiv = sectionObj.append("ol");

	if (this.isUnique())
	{
		sectionObj.classed("btn row-button", true);
		itemsDiv.classed("right-label", true);
		sectionObj.on("click", function(cell) {
			_clickEditObjectValue(cell.data[0], previousPanelNode);
		});
	}

	
	var divs = appendItems(itemsDiv, this.data);
	
	if (!this.isUnique())
		appendConfirmDeleteControls(divs);
		
	var buttons = appendRowButtons(divs);

	if (!this.isUnique())
	{
		buttons.on("click", function(d) {
				_clickEditObjectValue(d, previousPanelNode);
			});
		appendDeleteControls(buttons);
	}

	appendRightChevrons(buttons);	
		
	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
	
	var viewFunction = _isPickCell(this) ? showPickObjectPanel : showEditObjectPanel;
		
	var addedFunction = getOnValueAddedFunction(true, true, viewFunction);

	$(this).on("valueAdded.cr", null, itemsDiv.node(), addedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			$(eventObject.data).off("valueAdded.cr", null, addedFunction);
		});
	
	if (!this.isUnique())
	{
		function done(newValue)
		{
			viewFunction(newValue, previousPanelNode, revealPanelUp);
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

function appendActionButton(text, onClick)
{
	var itemsDiv = this.append('section')
		.classed('cell edit unique', true)
		.classed('btn row-button', true)
		.on('click', onClick)
		.append('ol');
	
	var button = itemsDiv.append('li')
		.append('div')
		.classed('left-expanding-div', true);
	appendRightChevrons(button);
		
	button.append('div')
		.classed("description-text string-value-view", true)
		.text(text);	
		
}

/* Append a set of buttons to each section for displaying the text for each item. */
function appendViewButtons(sections, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;

	var buttons = sections.append("div").classed("btn row-button multi-row-content expanding-div", true);
	
	fill(buttons);
		
	return buttons;
}

function appendItems(container, data)
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
		.each(_setupItemHandlers);
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

var SiteNavContainer = (function() {
	SiteNavContainer.prototype.nav = undefined;
	SiteNavContainer.prototype.div = undefined;
	
	SiteNavContainer.prototype.appendLeftButton = function()
	{
		return this.div.append("div").classed("left-link pull-left", true)
				   .append("div") .classed("site-navbar-link site-active-text", true);
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
			
		return rightChild.classed("right-link pull-right", true)
				   .append("div") .classed("site-navbar-link site-active-text", true);
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
	
    function SitePanel(containerPanel, datum, headerText, panelClass, showFunction) {
    	if (containerPanel === undefined)
    	{
    		/* In this case, we just want the prototype. The rest will get
    			initialized from the sub-class.
    		 */
    		this.panelDiv = undefined;
    		this.navContainer = undefined;
    		this.panel2Div = undefined;
    		this.headerText = null;
			this.hide = null;
    	}
    	else
    	{
    		var previousZIndex = parseInt($(containerPanel).css("z-index"));
			if (isNaN(previousZIndex))
				throw "containerPanel's z-index is not specified";
		
			var rootPanel = d3.select("body");
			var zindex = previousZIndex+1;
			this.panelDiv = rootPanel
							.append("panel")
							.classed("site-panel reveal", true)
							.style("z-index", zindex)
							.datum(datum)
							.attr("headerText", headerText);
			this.node().sitePanel = this;
							
			if (panelClass && panelClass.length > 0)
				this.panelDiv.classed(panelClass, true);
				
			this.headerText = headerText;
			var _this = this;
			if (showFunction === revealPanelUp)
			{
				this.hide = function()
					{
						_this.hidePanelDown();
					};
			}
			else
			{
				this.hide = function()
					{
						hidePanelRight(_this.node());
					};
			}
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
		var searchBarDiv = this.panelDiv.append("div").classed("searchbar", true);
		return setupSearchBar(searchBarDiv.node(), textChanged);
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
		var varNode = this.mainDiv.node();
		$(varNode).calculateFillHeight();
	}
	
	SitePanel.prototype.appendScrollArea = function()
	{
		var _this = this;
		var alertContainer = this.panelDiv.append('div').classed('alert-container', true);
		this.mainDiv = this.panelDiv
			.append("div").classed("panel-fill vertical-scrolling", true);
		
		$(this.node()).on("revealing.cr", function()
			{
				_this.calculateHeight();
			});
		
		resizeFunction = function()
			{
				_this.calculateHeight();
			}
		$(window).on("resize", resizeFunction);
		$(this.node()).on("remove", function(){
			$(window).off("resize", resizeFunction);
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
			cell.show(sectionNode, _this.node());
			$(sectionNode).css("display", _thisPanel2Div.isEmptyItems(itemsDiv) ? "none" : "");
			
			/* Make sure the section gets shown if a value is added to it. */
			var checkDisplay = function(eventObject, newValue)
			{
				$(eventObject.data).css("display", _thisPanel2Div.isEmptyItems(itemsDiv) ? "none" : "");
			}
			$(cell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, sectionNode, checkDisplay);
			$(sectionNode).on("remove", null, cell, function(eventObject)
				{
					$(eventObject.data).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, checkDisplay);
				});
			_setupItemsDivHandlers(itemsDiv, cell);
		}
		
		this.mainDiv.handleDoneEditingButton = function(done) {
			if (prepareClick('click', 'done editing'))
			{
				showClickFeedback(this);
		
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
				if (initialData.length > 0) {
					cr.updateValues(initialData, sourceObjects, 
						function() {
							if (done)
								done();
							_this.hide();
						}, 
						syncFailFunction);
				}
				else
				{
					if (done)
						done();
					_this.hide();
				}
			}
			d3.event.preventDefault();
		}
		
		/* d represents the newly created object that is being added. */
		this.mainDiv.handleDoneAddingButton = function(d) {
			if (prepareClick('click', 'done adding'))
			{
				showClickFeedback(this);
				
				var sections = _this.mainDiv.selectAll("section");
				if (d.cell.parent == null ||
					d.cell.parent.getValueID() != null)
				{
					var initialData = {}
					sections.each(
						function(cell) {
							cell.updateCell(this);
							cell.appendData(initialData);
						});
		
					d.saveNew(initialData, 
						function() { 
							_this.hide(); 
						}, 
						syncFailFunction);
				}
				else
				{
					/* In this case, we are editing an object that is contained in 
						an object that is being edited. This object will be saved
						as part of completing that edit operation. */
					d.cells = [];
					sections.each(
						function(cell) {
							cell.updateCell(this);
							d.importCell(cell);
						});
	
					d.calculateDescription();
					d.triggerDataChanged();
					_this.hide();
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
					cell.showEdit(this, _this.node());
				});
	}
	
	SitePanel.prototype.appendActionButton = function(text, onClick)
	{
		var itemsDiv = this.mainDiv.append('section')
			.classed('cell edit unique', true)
			.classed('btn row-button', true)
			.on('click', onClick)
			.append('ol');
		
		var button = itemsDiv.append('li')
			.append('div')
			.classed('left-expanding-div', true);
		appendRightChevrons(button);
			
		button.append('div')
			.classed("description-text string-value-view", true)
			.text(text);	
			
	}
	
	SitePanel.prototype.datum = function()
	{
		return this.panelDiv.datum();
	}
	
	SitePanel.prototype.hidePanelDown = function(doRemove, completeFunction)
	{
		doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
		closealert();
		$(this.node()).trigger("hiding.cr");
		$(this.node()).hide("slide", {direction: "down"}, 400,
			function() {
				if (doRemove)
					$(this).remove();
				unblockClick();
				if (completeFunction)
					completeFunction();
			});
	}
	
	SitePanel.prototype.handleCloseDownEvent = function()
	{
		if (!_isClickBlocked())
		{
			cr.logRecord('click', 'Close Down');
			_blockClick();
			this.hidePanelDown();
		}
		else
			cr.logRecord('click', 'Close Down blocked');
			
	}
	return SitePanel;
})();

var SearchView = (function () {
	SearchView.prototype.listPanel = null;
	SearchView.prototype.inputBox = null;
	SearchView.prototype.getDataChunker = null;
	SearchView.prototype._fill = null;
	SearchView.prototype._foundCompareText = null;
	SearchView.prototype._constrainCompareText = null;
	SearchView.prototype._searchTimeout = null;
	
	function SearchView(containerNode, placeHolder, fill, chunkerType) {
		if (containerNode)
		{
			var _this = this;
			this._fill = fill;
			var inputBox = this.appendInput(containerNode, placeHolder);
		
			this.inputBox = inputBox.node();
			$(this.inputBox).on("input", function() { _this.textChanged() });
			
			this.noResultsDiv = d3.select(containerNode).append('div')
				.classed('help-block noResults', true)
				.style('display', 'none');

			this.listPanel = this.appendSearchArea(containerNode);

			var done = function(foundObjects, startVal)
			{
				if (_this.inputBox.value.toLocaleLowerCase().trim() == startVal)
				{
					_this.showObjects(foundObjects);
					var text = _this.noResultString();
					_this.noResultsDiv.text(text);
					_this.noResultsDiv.style('display', (_this.getDataChunker.hasButtons() || text.length === 0) ? 'none' : null);
				}
			}
			chunkerType = chunkerType !== undefined ? chunkerType : GetDataChunker;
			this.getDataChunker = new chunkerType(this.listPanel.node(), done);
			
			/* Call setupInputBox at the end because it may trigger an input event. */
			this.setupInputBox();
			
		}
	}
	
	SearchView.prototype.onClickButton = function(d, i) {
		throw ("need to override SearchView.onClick");
	}
	
	SearchView.prototype.isButtonVisible = function(button, d)
	{
		throw ("need to override SearchView.isButtonVisible");
	}
	
	SearchView.prototype.searchPath = function(val)
	{
		throw ("need to override SearchView.searchPath");
	}
	
	SearchView.prototype.setupInputBox = function()
	{
		/* Do nothing by default */
	}
	
	SearchView.prototype.appendButtonContainers = function(foundObjects)
	{
		return this.getDataChunker.appendButtonContainers(foundObjects);
	}
	
	SearchView.prototype.clearListPanel = function()
	{
		this.listPanel.selectAll("li").remove();
	}
	
	SearchView.prototype.sortFoundObjects = function(foundObjects)
	{
		function sortByDescription(a, b)
		{
			return a.getDescription().localeCompare(b.getDescription());
		}
		foundObjects.sort(sortByDescription);
	}
	
	SearchView.prototype.constrainFoundObjects = function(val)
	{
		if (val !== undefined)
			this._constrainCompareText = val;
			
		var buttons = this.listPanel.selectAll(".btn");
		if (this._constrainCompareText != this._foundCompareText)
		{
			var _this = this;
			buttons.style("display", function(d) 
				{ 
					if (_this.isButtonVisible(this, d))
						return null;
					else
						return "none";
				});
		}
		else
			buttons.style("display", null);
	}
	
	SearchView.prototype.showObjects = function(foundObjects)
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
	SearchView.prototype.fields = function()
	{
		return ["parents"];
	}
	
	SearchView.prototype.noResultString = function()
	{
		return "No Results";
	}
	
	SearchView.prototype.search = function(val)
	{
		if (val !== undefined)
		{
			this._foundCompareText = val;
			this._constrainCompareText = val;
		}
			
		var searchPath = this.searchPath(this._constrainCompareText);
		if (searchPath && searchPath.length > 0)
		{
			//cr.selectAll({path: searchPath, end: 50, done: done, fail: asyncFailFunction});
			this.getDataChunker.path = searchPath;
			this.getDataChunker.fields = this.fields();
			this.getDataChunker.start(this._constrainCompareText);			
		}
		else
		{
			this.clearListPanel();
			this.getDataChunker.clearLoadingMessage();
		}
	}
	
	SearchView.prototype.inputText = function()
	{
		return this.inputBox.value.trim()
	}
	
	SearchView.prototype.inputCompareText = function()
	{
		return this.inputText().toLocaleLowerCase();
	}
	
	SearchView.prototype.startSearchTimeout = function(val)
	{
		this.clearListPanel();
		if (this.searchPath(val) != "")
			this.getDataChunker.showLoadingMessage();
				
		/* Once we have hit this point, old data is not valid. */
		this._foundCompareText = null;

		var _this = this;
		function endSearchTimeout() {
			_this._searchTimeout = null;
			_this.search(val);
		}
		this._searchTimeout = setTimeout(endSearchTimeout, 300);
	}
	
	SearchView.prototype.textCleared = function()
	{
		this.clearListPanel();
		this.getDataChunker.clearLoadingMessage();
		this._foundCompareText = null;
	}
	
	SearchView.prototype.textChanged = function()
	{
		if (this._searchTimeout != null)
		{
			clearTimeout(this._searchTimeout);
			this._searchTimeout = null;
		}
		
		var val = this.inputCompareText();
		if (val.length == 0)
		{
			this.textCleared();
		}
		else if (this._foundCompareText != null && 
				 (this._foundCompareText.length == 0 || val.indexOf(this._foundCompareText) == 0) &&
				 (this._foundCompareText.length >= 3 || val.length < 3))
		{
			if (this.getDataChunker.foundCount() < 50)
				this.constrainFoundObjects(val);
			else
				this.startSearchTimeout(val);
		}
		else
			this.startSearchTimeout(val);
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
	
	SearchView.prototype.appendSearchArea = function()
	{
		throw ("appendSearchArea must be overridden");
	}

	return SearchView;
})();

var PanelSearchView = (function() {
	PanelSearchView.prototype = new SearchView();
	PanelSearchView.prototype.sitePanel = undefined
	
	function PanelSearchView(sitePanel, placeholder, fill, chunkerType) {
		if (sitePanel)
		{
			/* Set sitePanel first for call to appendSearchArea */
			this.sitePanel = sitePanel;
			SearchView.call(this, sitePanel.node(), placeholder, fill, chunkerType);
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

	
/* Returns the input DOM element that contains the text being searched. */
function setupSearchBar(searchBarNode, textChanged)
{
	var searchBar = d3.select(searchBarNode);
	
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
	}
	
	$(window).on("resize", resizeSearchCancelHeight);
	resizeSearchCancelHeight();
	
	$(searchInputContainer.node()).on("remove", function(e)
	{
		$(window).off("resize", resizeSearchCancelHeight);
	});
	
	return searchInput.node();
}

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
	showPanelLeft(panelDiv, unblockClick);
}

function revealPanelUp(panelDiv)
{
	showPanelUp(panelDiv, unblockClick);
}

/* Displays a panel in which the specified object's contents appear without being able to edit.
 */
function showViewOnlyObjectPanel(objectData, previousPanelNode) {
	successFunction = function ()
	{
		var sitePanel = new SitePanel(previousPanelNode, 
									objectData, getViewPanelHeader(objectData), "view");

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("div").text(" " + previousPanelNode.getAttribute("headerText"));
	
		var panel2Div = sitePanel.appendScrollArea();

		var headerDiv = panel2Div.appendHeader();

		showPanelLeft(sitePanel.node(), unblockClick);
	
		panel2Div.append("div").classed("cell-border-below", true);
		sitePanel.showViewCells(objectData.cells);
	}
	
	objectData.checkCells(undefined, successFunction, syncFailFunction)
}

/* Displays a panel in which the specified object's contents appear.
 */
function showViewObjectPanel(objectData, previousPanelNode, showFunction) {
	var successFunction = function ()
	{
		var sitePanel = new SitePanel(previousPanelNode, 
									objectData, getViewPanelHeader(objectData), "view", showFunction);

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("div").text(" " + previousPanelNode.getAttribute("headerText"));
	
		if (objectData.canWrite())
		{
			var editButton = navContainer.appendRightButton()
				.on("click", function(d) {
					if (prepareClick('click', 'view object panel: Edit'))
					{
						showClickFeedback(this);
				
						showEditObjectPanel(objectData, sitePanel.node(), revealPanelUp);
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
		$(objectData).on("dataChanged.cr", null, headerDiv.node(), updateHeader);
		$(headerDiv.node()).on("remove", null, objectData, function(eventObject)
		{
			$(eventObject.data).off("dataChanged.cr", null, updateHeader);
		});

		panel2Div.append("div").classed("cell-border-below", true);
		sitePanel.showViewCells(objectData.cells);
		
		showFunction(sitePanel.node());
	}
	
	objectData.checkCells(undefined, successFunction, syncFailFunction)
}

function _b64_to_utf8( str ) {
    str = str.replace(/\s/g, '');    
    return decodeURIComponent(escape(window.atob( str )));
}

/* 
	Displays a panel for editing the specified object. 
 */
function showEditObjectPanel(objectData, previousPanelNode, onShow) {
	if (!objectData)
		throw "objectData is not initialized";
		
	var containerCell = objectData.cell;
		
	var successFunction = function()
	{
		var header;
		if (objectData.getValueID())
			header = "Edit";
		else
			header = "New " + objectData.cell.field.name;
			
		var sitePanel = new SitePanel(previousPanelNode, objectData, header, "edit", onShow);

		var navContainer = sitePanel.appendNavContainer();

		var panel2Div = sitePanel.appendScrollArea();
		sitePanel.showEditCells(objectData.cells);

		var doneButton;
		if (objectData.getValueID())
		{
			if (onShow === revealPanelUp)
				doneButton = navContainer.appendRightButton();
			else
				doneButton = navContainer.appendLeftButton();
			doneButton.append("span").text("Done");
			doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
				});
		}
		else
		{
			doneButton = navContainer.appendRightButton();
			doneButton.append("span").text("Add");
			doneButton.on("click", panel2Div.handleDoneAddingButton);
			var backButton = navContainer.appendLeftButton()
				.on("click", function()
				{
					if (prepareClick('click', 'edit object panel: Cancel'))
					{
						if (!objectData.cell.isUnique())
						{
							// In this case, delete the item on cancel. 
							objectData.triggerDeleteValue();
						}
						sitePanel.hide();
					}
					d3.event.preventDefault();
				});
			backButton.append("span").text("Cancel");
		}
		navContainer.appendTitle(header);

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
									 			for (var name in d)
									 			{
													for (var i = 0; i < objectData.cells.length; ++i)
													{
														var cell = objectData.cells[i];
														if (cell.field.name === name)
														{
															cr.createInstance(cell.field, objectData.getValueID(), d[name], 
																function(newData)
																{
																	cell.addValue(newData);
																},
																asyncFailFunction);
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
		
		onShow(sitePanel.node());
	}
	
	if (objectData.getValueID())
		objectData.checkCells(undefined, successFunction, syncFailFunction);
	else
		objectData.checkConfiguration(successFunction, syncFailFunction);
}

function getViewRootObjectsFunction(cell, previousPanelNode, header, sortFunction, successFunction)
{
	return function(rootObjects)
	{
		if (sortFunction)
			rootObjects.sort(sortFunction);
			
		for (var i = 0; i < rootObjects.length; i++)
			cell.pushValue(rootObjects[i]);
		
		var sitePanel = new SitePanel(previousPanelNode, cell, header, "list");

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
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
				
							showEditRootObjectsPanel(cell, sitePanel.node(), "Edit " + header, sortFunction);
						}
						d3.event.preventDefault();
					});
				editButton.append("span").text("Edit");
			}
			navContainer.appendTitle(header);
		}
		
		if (cr.signedinUser.cells)
			checkEdit();
		else
		{
			$(cr.signedinUser).on("signin.cr", null, navContainer.nav.node(), checkEdit);
			$(navContainer.nav.node()).on("remove", null, cr.signedinUser, function()
				{
					$(eventObject.data).off("signin.cr", navContainer.nav.node(), checkEdit);
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

		$(cell).on("valueAdded.cr", null, itemsDiv.node(), addedFunctionWithSort);
		$(cell).on("dataChanged.cr", null, itemsDiv.node(), dataChangedFunction);
		$(itemsDiv.node()).on("remove", null, this, function(eventObject)
			{
				$(eventObject.data).off("valueAdded.cr", null, addedFunctionWithSort);
				$(eventObject.data).off("dataChanged.cr", null, dataChangedFunction);
			});
	
		appendViewCellItems(itemsDiv, cell, 
			function(d) {
				if (prepareClick('click', 'view root object: ' + d.getDescription()))
				{
					showViewObjectPanel(d, sitePanel.node(), revealPanelLeft);
				}
			});

		_setupItemsDivHandlers(itemsDiv, cell);
		if (successFunction)
			successFunction(sitePanel.node());
	}
}

function showEditRootObjectsPanel(cell, previousPanelNode, header, sortFunction)
{
	var sitePanel = new SitePanel(previousPanelNode, cell, header, "list");

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
				showClickFeedback(this);
			
				var newValue = cell.addNewValue();
				showEditObjectPanel(newValue, sitePanel.node(), revealPanelUp);
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

	$(cell).on("valueAdded.cr", null, itemsDiv.node(), addedFunctionWithSort);
	$(cell).on("dataChanged.cr", null, itemsDiv.node(), dataChangedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			$(eventObject.data).off("valueAdded.cr", null, addedFunctionWithSort);
			$(eventObject.data).off("dataChanged.cr", null, dataChangedFunction);
		});

	appendEditCellItems(itemsDiv, cell, 
		function(d) {
			if (prepareClick('click', 'edit cell item: ' + d.getDescription()))
			{
				showEditObjectPanel(d, sitePanel.node(), revealPanelLeft);
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
											cr.createInstance(cell.field, null, d, 
												function(newData)
												{
													cell.addValue(newData);
												},
												asyncFailFunction);
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
	
	showPanelUp(sitePanel.node(), unblockClick);
}

/* Displays a panel from which a user can select an object of the kind required 
	for objects in the specified cell.
 */
function showPickObjectPanel(oldData, previousPanelNode) {
	if (!oldData)
		throw "oldData is not defined";
		
	var failFunction = syncFailFunction;
	
	function selectAllSuccessFunction(rootObjects) {
		if (!("pickObjectPath" in oldData.cell.field && oldData.cell.field.pickObjectPath))
		{
			rootObjects.sort(function(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				});
		}
	
		var panelDatum;
		if (oldData.id)
			panelDatum = oldData;	/* Replacing an existing object. */
		else
			panelDatum = oldData.cell;		/* Adding a new object. */
		var sitePanel = new SitePanel(previousPanelNode, panelDatum, oldData.cell.field.name, "list");

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'pick object panel: Cancel'))
				{
					if (!oldData.getValueID() && !oldData.cell.isUnique())
					{
						// In this case, delete the item on cancel. 
						oldData.cell.deleteValue(oldData);
					}
					hidePanelRight(sitePanel.node());
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
		
		navContainer.appendTitle(oldData.cell.field.name);

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
				hidePanelRight(sitePanel.node());
			}
			
			if (prepareClick('click', 'pick object panel: ' + d.getDescription()))
			{
				if (d.getValueID() === oldData.getValueID()) {
					successFunction();
				}
				else if (oldData.id)
				{
					if (d.getValueID())
					{
						cr.updateObjectValue(oldData, d, -1, successFunction, syncFailFunction);
					}
					else
					{
						oldData.deleteValue(successFunction, syncFailFunction);
					}
				}
				else if (d.getValueID())
				{
					if (oldData.cell.parent && oldData.cell.parent.getValueID())	/* In this case, we are adding an object to an existing object. */
					{
						oldData.cell.addObjectValue(d, successFunction, syncFailFunction);
					}
					else 
					{
						/* In this case, we are replacing an old value for
						   an item that was added to the cell but not saved;
						   a placeholder or a previously picked value.
						 */
						oldData.updateFromChangeData({instanceID: d.getValueID(), description: d.getDescription()});
						oldData.triggerDataChanged();
						successFunction();
					}
				}
				else
					successFunction();
			}
			d3.event.preventDefault();
		}
		
		if (oldData.cell.isUnique())
		{
			var nullObjectValue = new cr.ObjectValue();
			rootObjects = [nullObjectValue].concat(rootObjects);
		}
		var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
		
		buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
			function(d) { return d.getDescription() == oldData.getDescription(); });
	
		showPanelLeft(sitePanel.node(), unblockClick);
	}
	
	if (oldData.cell.field.pickObjectPath)
	{
		var pickObjectPath = oldData.cell.field.pickObjectPath;
		if (pickObjectPath.indexOf("parent") === 0 &&
			">:=<".indexOf(pickObjectPath.charAt(6)) >= 0)
		{
			var currentObject = oldData.cell.parent;
			pickObjectPath = pickObjectPath.slice(6);
			while (currentObject != null &&
				   pickObjectPath.indexOf("::reference(") === 0 &&
				   !currentObject.getValueID())
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
			if (currentObject != null && currentObject.getValueID())
			{
				pickObjectPath = "#"+currentObject.getValueID()+pickObjectPath;
				cr.selectAll({path: pickObjectPath, done: selectAllSuccessFunction, fail: syncFailFunction});
			}
			else
				syncFailFunction("The container has not yet been saved.");
		}
		else	
			cr.selectAll({path: pickObjectPath, done: selectAllSuccessFunction, fail: syncFailFunction});
	}
	else
		cr.selectAll({path: oldData.cell.field.ofKindID, done: selectAllSuccessFunction, fail: syncFailFunction});
}
		
