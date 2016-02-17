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

var crv = {
	/* Reference https://www.loc.gov/standards/iso639-2/php/code_list.php */
	defaultLanguageCode: "en",
	languages: [{code: "en", name: "English"}, 
			    {code: "sp", name: "Spanish"},
			    {code: "zh", name: "Chinese"}],
			    
	appendLoadingMessage: function(node)
	{
		return d3.select(node).append('p')
			.classed("help-block", true)
			.text("Loading...");
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

function prepareClick(name, message)
{
	if (_isClickBlocked())
	{
		if (name)
			cr.logRecord(name + ' blocked', message);
		return false;
	}
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

function showPanelUp(panelNode)
{
	window.scrollTo(0, 0);
	$(panelNode).hide("slide", {direction: "down"}, 0);
	$(panelNode).height("100%")
				.width("100%")
				.css("display", "table")
				.trigger("revealing.cr");
	$(window).trigger("resize");
	$(panelNode).effect("slide", {direction: "down"}, 400, function() {
							unblockClick();
						});
}

/* Note that this function doesn't unblockClick */
function showPanelNow(panelNode)
{
	$(panelNode).offset({top: 0, left: 0})
				.height("100%")
				.width("100%")
				.css("display", "table")
				.trigger("revealing.cr");
	$(window).trigger("resize");
}

function showPanelLeft(panelNode)
{
	window.scrollTo(0, 0);
	$(panelNode).hide("slide", {direction: "right"}, 0);
	$(panelNode).height("100%")
				.width("100%")
				.css("display", "table")
				.trigger("revealing.cr");
	$(window).trigger("resize");
	$(panelNode).effect("slide", {direction: "right"}, 400, function() {
							unblockClick();
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
	if (!_isClickBlocked())
	{
		cr.logRecord('click', 'Close Right');
		_blockClick();
		hidePanelRight($(this).parents(".site-panel")[0]);
	}
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
		$(this.eventObject).off("dataChanged.cr", null, this, f);
	});
	
	if (d.cell && d.cell.field.capacity === "_unique value")
	{
		$(d).on("valueDeleted.cr", null, this, f);
		$(this).on("remove", null, d, function(eventObjects) {
			$(this.eventObject).off("valueDeleted.cr", null, this, f);
		});
	}
}

function _getDataValue(d) { return d.value; }
function _getDataDescription(d) { return d.getDescription() }

function _checkItemsDivDisplay(itemsDiv)
{
	var classList = itemsDiv.node().parentNode.classList;
	var isVisible = classList.contains("unique");
	var isEdit = classList.contains("edit");
	
	var items = itemsDiv.selectAll("li");
	
	if (isEdit)
		isVisible |= items.size() > 0;
	else
		items.each(function(d) {
			isVisible |= !d.isEmpty();
		});
		
	itemsDiv.style("display", isVisible ? null : "none");
}

function _setupItemsDivHandlers(itemsDiv, cell)
{
	node = itemsDiv.node();
	function checkVisible(eventObject)
	{
		/* In this case, make the itemsDiv visible if the corresponding cell has any values (empty or otherwise) */
		var classList = eventObject.data.parentNode.classList;
		var isVisible = classList.contains("unique");
		var isEdit = classList.contains("edit");
		
		if (isEdit)
			isVisible |= this.data.length > 0;
		else
		{
			this.data.forEach(function(d) {
				isVisible |= !d.isEmpty();
			});
		}
		
		$(eventObject.data).css("display", isVisible ? "" : "none");
	}
	$(cell).on("dataChanged.cr", null, node, checkVisible);
	$(node).on("remove", null, cell, function(eventObject)
	{
		$(eventObject.data).off("dataChanged.cr", null, checkVisible);
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
			$(eventObject.data).animate({height: "0px"}, 600, 'swing', function()
			{
				var parentNode = this.parentNode;
				$(this).remove();
				/* Now that the item is removed, check whether its container should be visible. */
				_checkItemsDivDisplay(d3.select(parentNode));
			});
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

	if (cell.field.capacity == "_unique value")
		itemsDiv.classed("right-label", true);

	var setupItems = function(divs, cell) {
		divs.classed("multi-line-item", cell.field.capacity != "_unique value")
		.append("div")
		.classed("string-value-view", true)
		.text(_getDataValue)
		.each(_pushTextChanged);
	}
	
	_setupItemsDivHandlers(itemsDiv, cell);
	
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
	
	if (cell.field.capacity === "_unique value")
	{
		var itemsDiv = sectionObj.append("ol").classed("items-div", true);

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
		sectionObj.append("label")
			      .text(cell.field.name);
		var itemsDiv = sectionObj.append("ol")
			.classed("items-div", true);
		_setupItemsDivHandlers(itemsDiv, cell);

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
	    	var newValue = d.value;
	    	if (newValue && newValue.length > 0)
 				input.value(newValue);
	    });
	}
	
	if (this.field.capacity === "_unique value")
	{
		var itemsDiv = sectionObj.append("ol").classed("items-div", true);

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
		sectionObj.append("label")
			      .text(this.field.name);
		var itemsDiv = sectionObj.append("ol")
			.classed("items-div", true);
		_setupItemsDivHandlers(itemsDiv, this);

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
				if (crv.languages[i].code == d.value.languageCode)
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
			.property("value", function(d) { return d.value.text; });
	}
	
	if (cell.field.capacity == "_unique value")
	{
		var itemsDiv = sectionObj.append("ol").classed("items-div", true);

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
		sectionObj.append("label")
			      .text(cell.field.name);
		var itemsDiv = sectionObj.append("ol")
			.classed("items-div", true);
		_setupItemsDivHandlers(itemsDiv, cell);

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
		
		var previousPanelNode = $(itemsDiv.node()).parents(".site-panel")[0];
		var item = appendItem(itemsDiv, newValue);
		_checkItemsDivDisplay(itemsDiv);
		
		/* Hide the new button if it is blank, and then show it if the data changes. */
		item.style("display", 
				   (cell.field.capacity === "_unique value" || newValue.getValueID()) ? null : "none");
				   
		if (cell.field.capacity != "_unique value")
		{
			function checkVisible(eventObject)
			{
				d3.select(eventObject.data).style("display", 
					   this.getValueID() || this.value.cells.length > 0 ? null : "none");
			}
			$(newValue).on("dataChanged.cr", null, item.node(), checkVisible);
			$(item.node()).on("remove", null, newValue, function(eventObject)
			{
				$(eventObject.data).off("dataChanged.cr", null, checkVisible);
			});
		}

		if (canDelete && cell.field.capacity != "_unique value")
			appendConfirmDeleteControls(item);
		
		var buttons = appendRowButtons(item);

		buttons.on("click", function(d) {
			if (prepareClick('click', 'view added item: ' + d.getDescription()))
			{
				viewFunction(d, previousPanelNode, revealPanelLeft);
			}
		});
		if (canDelete && cell.field.capacity != "_unique value")
			appendDeleteControls(buttons);
		if (canShowDetails)
			appendRightChevrons(buttons);

		appendButtonDescriptions(buttons)
			.each(_pushTextChanged);
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

function appendConfirmDeleteControls(divs)
{
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
		.on('click', function(d)
		{
			if (prepareClick('click', 'confirm delete: ' + d.getDescription()))
				d.deleteValue(unblockClick, syncFailFunction);
		});
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

function _updateTextValue(d, newValue)
{
	/* If both are null, then they are equal. */
	if (!newValue && !d.value)
		newValue = d.value;

	if (newValue != d.value)
	{
		d.value = newValue;
	}
}

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

function _getDatestampDayOptionalValue()
{
	var obj = d3.select(this);
	var dateObj = obj.selectAll(".date-row");
	return dateObj.node().dateInput.value();
}

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
	/* If both are null, then they are equal. */
	if (!newValue.text && !d.value.text)
		newValue.text = d.value.text;
		
	if (newValue.text !== d.value.text || 
		newValue.languageCode !== d.value.languageCode)
	{
		d.value = newValue;
	}
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
			_updateTextValue(d, newValue);
		}
	);
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
	d3.select(sectionObj).selectAll(".items-div>li").each(function(d, i)
		{
			if (d.id)
			{
				/* Do nothing. */ ;
			}
			else if ("cells" in d.value)
			{
				/* This case is true if we are creating an object */
				var subData = {}
				$(d.value.cells).each(function()
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
	_setupItemsDivHandlers(itemsDiv, this);

	if (this.field.capacity === "_unique value")
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
	if (_isPickCell(this) || this.field.capacity === "_unique value")	/* Unique value handles the click above */
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
		buttons = divs.append("div").classed("multi-line-item", this.field.capacity != "_unique value");
	}
	
	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
}

cr.ObjectCell.prototype.showEdit = function(obj, previousPanelNode)
{
	var sectionObj = d3.select(obj);
	
	var labelDiv = sectionObj.append("label")
		.text(this.field.name);
	var itemsDiv = sectionObj.append("ol").classed("items-div", true);

	if (this.field.capacity === "_unique value")
	{
		sectionObj.classed("btn row-button", true);
		itemsDiv.classed("right-label", true);
		sectionObj.on("click", function(cell) {
			_clickEditObjectValue(cell.data[0], previousPanelNode);
		});
	}

	_setupItemsDivHandlers(itemsDiv, this);
	
	var viewFunction = _isPickCell(this) ? showPickObjectPanel : showEditObjectPanel;
		
	var addedFunction = getOnValueAddedFunction(true, true, viewFunction);

	$(this).on("valueAdded.cr", null, itemsDiv.node(), addedFunction);
	$(itemsDiv.node()).on("remove", null, this, function(eventObject)
		{
			$(eventObject.data).off("valueAdded.cr", null, addedFunction);
		});
	
	var divs = appendItems(itemsDiv, this.data);
	
	if (this.field.capacity != "_unique value")
		appendConfirmDeleteControls(divs);
		
	var buttons = appendRowButtons(divs);

	if (this.field.capacity !== "_unique value")
	{
		buttons.on("click", function(d) {
				_clickEditObjectValue(d, previousPanelNode);
			});
		appendDeleteControls(buttons);
	}

	appendRightChevrons(buttons);	
		
	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
	
	if (this.field.capacity != "_unique value")
	{
		function done(newValue)
		{
			viewFunction(newValue, previousPanelNode, revealPanelUp);
		}
		
		crv.appendAddButton(sectionObj, done);
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
		.append("ol")
		.classed("items-div", true);

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

function appendItem(container, value)
{
	return container
		.append("li")	// So that each button appears on its own row.
		.datum(value)
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
	
	if (cell.field.capacity != "_unique value")
		appendConfirmDeleteControls(divs);
	
	var buttons = appendRowButtons(divs);
	
	if (cell.field.capacity != "_unique value")
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
	
	SiteNavContainer.prototype.appendTitle = function(newTitle)
	{
		var h = this.div.append("div").classed("site-navbar-commands", true)
				   .append("div").classed("site-title", true)
				   .text(newTitle);
		h.style("width", (getTextWidth(newTitle, h.style("font"))+1).toString() + "px")
		this.div.selectAll('.left-link').classed('pull-left', true);
		return h;
	}
	
	function SiteNavContainer(sitePanel)
	{
		this.nav = sitePanel.panelDiv.append("nav").classed("table-row", true)
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
		
			var rootPanel = d3.select(containerPanel.parentNode);
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
		var searchBarDiv = this.panelDiv.append("div").classed("searchbar table-row", true);
		return setupSearchBar(searchBarDiv.node(), textChanged);
	}
	
	SitePanel.prototype.appendFillArea = function()
	{
		var _this = this;
		this.panelDiv.append('div').classed('alert-container table-row', true);
		var panel2Div = this.panelDiv
			.append("div").classed("body", true)
			.append("div")
			.append("div").classed("panel-fill", true)
			.style("overflow-y", "hidden");
			
		return panel2Div;
	}
	
	SitePanel.prototype.appendScrollArea = function()
	{
		var _this = this;
		this.panelDiv.append('div').classed('alert-container table-row', true);
		var panel2Div = this.panelDiv
			.append("div").classed("body", true)
			.append("div")
			.append("div").classed("panel-fill vertical-scrolling", true);
		
		panel2Div.appendHeader = function()
		{
			return this.append("header")
				.text(_this.headerText);
		}
		
		panel2Div.appendSections = function(sectionData)
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
		panel2Div.appendSection = function(datum)
		{
			return this.append("section").datum(datum);
		}
				
		panel2Div.showViewCells = function(cells)
		{
			this.appendSections(cells.filter(function(cell) { return cell.field.descriptorType != "_by text" }))
				.classed("cell view", true)
				.classed("unique", function(cell) { return cell.field.capacity === "_unique value"; })
				.classed("multiple", function(cell) { return cell.field.capacity !== "_unique value"; })
				.each(function(cell) {
						var section = d3.select(this);
						section.append("label").text(cell.field.name);
						section.append("ol").classed("items-div", true);
						cell.show(this, _this.node());
						$(this).css("display", cell.isEmpty() ? "none" : "");
					
						/* Make sure the section gets shown if a value is added to it. */
						var checkDisplay = function(eventObject, newValue)
						{
							$(eventObject.data).css("display", this.isEmpty() ? "none" : "");
						}
						$(cell).on("valueAdded.cr dataChanged.cr", null, this, checkDisplay);
						$(this).on("remove", null, cell, function(eventObject)
							{
								$(eventObject.data).off("valueAdded.cr dataChanged.cr", null, checkDisplay);
							});
					})
				.append("div").classed("cell-border-below", true);
		}
		
		panel2Div.handleDoneEditingButton = function() {
			if (prepareClick('click', 'done editing'))
			{
				showClickFeedback(this);
		
				var sections = panel2Div.selectAll("section");
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
							_this.hide();
						}, 
						syncFailFunction);
				}
				else
				{
					_this.hide();
				}
			}
			d3.event.preventDefault();
		}
		
		/* d represents the newly created object that is being added. */
		panel2Div.handleDoneAddingButton = function(d) {
			if (prepareClick('click', 'done adding'))
			{
				showClickFeedback(this);
				
				var objectData = d;
		
				var sections = panel2Div.selectAll("section");
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
					d.value.cells = [];
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
		
		panel2Div.showEditCells = function(cells)
		{
			this.appendSections(cells)
				.classed("cell edit", true)
				.classed("unique", function(cell) { return cell.field.capacity === "_unique value"; })
				.classed("multiple", function(cell) { return cell.field.capacity !== "_unique value"; })
				.each(function(cell) {
						cell.showEdit(this, _this.node());
					});
		}
		
		return panel2Div;
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
	
/* Returns the input DOM element that contains the text being searched. */
function setupSearchBar(searchBarNode, textChanged)
{
	var searchBar = d3.select(searchBarNode);
	
	var searchCancelButton = searchBar.append("span")
		.classed("search-cancel-button site-disabled-text", true);
	searchCancelButton.append("span").text("Cancel");
	var searchInputContainer = searchBar.append("div")
		.classed("search-input-container", true);
		
	var searchInput = searchInputContainer
		.append("input")
		.classed("search-input", true)
		.attr("placeholder", "Search");
	
	var lastText = "";	
	$(searchInput.node()).on("keyup input paste", function(e) {
		searchCancelButton
			.classed("site-disabled-text", this.value.length === 0)
			.classed("site-active-text", this.value.length > 0);
		if (lastText != this.value)
		{
			lastText = this.value;
			textChanged.call(this);
		}
	});
	
	$(searchCancelButton.node()).on("click", function(e) {
		searchInput.node().value = "";
		$(searchInput.node()).trigger("input");
	});
	
	function resizeSearchCancelHeight()
	{
		var h = searchInputContainer.node().getBoundingClientRect().height
			- searchCancelButton.node().getBoundingClientRect().height
			+ parseInt(searchCancelButton.style("padding-top"))
			+ parseInt(searchCancelButton.style("padding-bottom"));
		searchCancelButton.style("padding-top",(h/2).toString()+"px")
			.style("padding-bottom", (h/2).toString()+"px");
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
	showPanelLeft(panelDiv);
}

function revealPanelUp(panelDiv)
{
	showPanelUp(panelDiv);
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

		showPanelLeft(sitePanel.node());
	
		panel2Div.append("div").classed("cell-border-below", true);
		panel2Div.showViewCells(objectData.value.cells);
	}
	
	objectData.checkCells(undefined, successFunction, syncFailFunction)
}

/* Displays a panel in which the specified object's contents appear.
 */
function showViewObjectPanel(objectData, previousPanelNode, showSuccessFunction) {
	successFunction = function ()
	{
		var sitePanel = new SitePanel(previousPanelNode, 
									objectData, getViewPanelHeader(objectData), "view", showSuccessFunction);

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("div").text(" " + previousPanelNode.getAttribute("headerText"));
	
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
		panel2Div.showViewCells(objectData.value.cells);
		
		showSuccessFunction(sitePanel.node());
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
		panel2Div.showEditCells(objectData.value.cells);

		var doneButton;
		if (objectData.getValueID())
		{
			if (onShow === revealPanelUp)
				doneButton = navContainer.appendRightButton();
			else
				doneButton = navContainer.appendLeftButton();
			doneButton.append("span").text("Done");
			doneButton.on("click", panel2Div.handleDoneEditingButton);
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
						if (objectData.cell.field.capacity != "_unique value")
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
													for (var i = 0; i < objectData.value.cells.length; ++i)
													{
														var cell = objectData.value.cells[i];
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
		
		navContainer.appendTitle(header);
		
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
			.classed("items-div border-above", true)
			.datum(cell);
		
		_setupItemsDivHandlers(itemsDiv, cell);

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
		.classed("items-div border-above", true)
		.datum(cell);

	_setupItemsDivHandlers(itemsDiv, cell);
	
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
	
	showPanelUp(sitePanel.node());
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
					if (!oldData.getValueID() && oldData.cell.field.maxCapacity != "_unique value")
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
						oldData.updateFromChangeData({value: d.getValueID(), description: d.getDescription()});
						oldData.triggerDataChanged();
						successFunction();
					}
				}
				else
					successFunction();
			}
			d3.event.preventDefault();
		}
		
		if (oldData.cell.field.capacity === "_unique value")
		{
			var nullObjectValue = new cr.ObjectValue();
			rootObjects = [nullObjectValue].concat(rootObjects);
		}
		var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
		
		buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
			function(d) { return d.getDescription() == oldData.getDescription(); });
	
		showPanelLeft(sitePanel.node());
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
		
