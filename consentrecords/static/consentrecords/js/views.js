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

function syncFailFunction(error)
{
	bootstrap_alert.warning(error, ".alert-container");
	$(".alert-container").parents(".vertical-scrolling").scrollTop(0);
	unblockClick();
}

/* A default function used to report an error during an asynchronous operation
	without unblocking a user event. */
function asyncFailFunction(error)
{
	bootstrap_alert.warning(error, ".alert-container");
	$(".alert-container").parents(".vertical-scrolling").scrollTop(0);
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
	if (clickBlockCount == 0)
		throw ("Click unblocked.");
	clickBlockCount -= 1;
}

function prepareClick()
{
	if (_isClickBlocked())
		return false;
	closealert();
	_blockClick();
	return true;
}
 
function showClickFeedback(obj)
{
	var oldOpacity = $(obj).css("opacity");
	$(obj).animate({opacity: "0.2"}, 200)
		   .animate({opacity: oldOpacity}, 200, "swing",
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
				.css("display", "block")
				.trigger("revealing.cr");
	$(window).trigger("resize");
	$(panelNode).effect("slide", {direction: "down"}, 400, function() {
							$(window).trigger("resize");
							unblockClick();
						});
}

/* Note that this function doesn't unblockClick */
function showPanelNow(panelNode)
{
	$(panelNode).offset({top: 0, left: 0})
				.height("100%")
				.width("100%")
				.css("display", "block")
				.trigger("revealing.cr");
	$(window).trigger("resize");
}

function showPanelLeft(panelNode)
{
	window.scrollTo(0, 0);
	$(panelNode).hide("slide", {direction: "right"}, 0);
	$(panelNode).height("100%")
				.width("100%")
				.css("display", "block")
				.trigger("revealing.cr");
	$(window).trigger("resize");
	$(panelNode).effect("slide", {direction: "right"}, 400, function() {
							$(window).trigger("resize");
							unblockClick();
						});
}

function hidePanelDown(panelNode, doRemove)
{
	doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
	closealert();
	$(panelNode).trigger("hiding.cr");
	$(panelNode).hide("slide", {direction: "down"}, 400,
		function() {
			if (doRemove)
				$(this).remove();
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
		_blockClick();
		hidePanelRight($(this).parents(".site-panel")[0]);
	}
	d3.event.preventDefault();
}

function handleCloseDownEvent() {
	if (!_isClickBlocked())
	{
		_blockClick();
		hidePanelDown($(this).parents(".site-panel")[0]);
	}
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
	d.addTarget("dataChanged.cr", this);
	$(this).on("dataChanged.cr", function(e) {
			d3.select(this).text(d.getDescription());
		});
	if (d.cell && d.cell.field.capacity == "_unique value")
	{
		d.addTarget("value_deleted", this);
		$(this).on("valueDeleted.cr", function(e) {
			d3.select(this).text(d.getDescription());
		});
	}
}

function _getDataValue(d) { return d.value; }
function _getDataDescription(d) { return d.getDescription() }

function _checkItemsDivDisplay(itemsDiv, cell)
{
	var isVisible = (cell.field.capacity == "_unique value");
	var dt = cr.dataTypes[cell.field.dataType];
	// Loop over cell.data instead of itemsDiv cells in case this test is done before
	// the deleted cell is deleted or the added cell is added. 
	for (var i = 0; i < cell.data.length && !isVisible; i++)
		isVisible |= !dt.isEmpty(cell.data[i]);
	itemsDiv.style("display", isVisible ? "block" : "none");
}

function _setupItemsDivHandlers(itemsDiv, cell)
{
	cell.addTarget("valueAdded.cr", itemsDiv.node());
	cell.addTarget("valueDeleted.cr", itemsDiv.node());
	cell.addTarget("dataChanged.cr", itemsDiv.node());
	$(itemsDiv.node()).on("dataChanged.cr valueDeleted.cr valueAdded.cr", function(e)
		{
			_checkItemsDivDisplay(itemsDiv, cell);
		});
}

function _setupEditItemsDivHandlers(itemsDiv, cell)
{
	node = itemsDiv.node();
	cell.addTarget("valueAdded.cr", node);
	cell.addTarget("valueDeleted.cr", node);
	cell.addTarget("dataChanged.cr", node);
	$(node).on("dataChanged.cr valueDeleted.cr valueAdded.cr", function(e)
		{
			itemsDiv.style("display", cell.data.length ? "block" : "none");
		});
	$(node).on("remove", function(e)
	{
		cell.removeTarget("valueAdded.cr", node);
		cell.removeTarget("valueDeleted.cr", node);
		cell.removeTarget("dataChanged.cr", node);
	});
}

function _setupItemHandlers(d)
{
	/* This method may be called for a set of items that were gotten directly and are not
		part of a cell. Therefore, we have to test whether d.cell is not null.
	 */
	if (d.cell)
	{
		if (d.cell.field.capacity != "_unique value")
		{
			$(this).on("valueDeleted.cr", function(e, newData)
			{
				$(this).off("valueDeleted.cr");
				$(this).animate({height: "0px"}, 200, 'swing', function() { $(this).remove(); });
			});
			d.addTarget("valueDeleted.cr", this);
		}
	}
	$(this).on("remove", function(e)
	{
		d.removeTarget("valueDeleted.cr");
		d.removeTarget("dataChanged.cr");
	});
}

function _showViewStringCell(obj, cell)
{
	var sectionObj = d3.select(obj);
	
	var labelDiv = sectionObj.append("div").classed("cell-label", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		sectionObj.classed("unique-cell", true);
		labelDiv.classed("left-label left-fixed-width", true);
		itemsDiv.classed("right-label expanding-div", true);
	}
	else
	{
		sectionObj.classed("multiple-values-cell", true);
		labelDiv.classed("top-label", true);
	}

	var setupItems = function(divs, cell) {
		divs.classed("multi-line-item", cell.field.capacity != "_unique value")
		.append("div")
		.classed("string-value-view", true)
		.classed("string-multi-value-container", cell.field.capacity != "_unique value")
		.text(_getDataValue)
		.each(_pushTextChanged);
	}
	
	_setupItemsDivHandlers(itemsDiv, cell);
	$(itemsDiv.node()).on("valueAdded.cr", function(e, newData)
		{
			setupItems(
				d3.select(this).append("li"), cell);
		});
	
	var divs = appendItems(itemsDiv, cell.data);
	setupItems(divs, cell);
}

function _confirmDeleteClick(d)
{
	if (prepareClick())
	{
		cr.deleteValue(d, unblockClick, syncFailFunction);
	}
}

function _showEditStringCell(obj, panelDiv, cell, containerUUID, inputType)
{
	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true);
	
	if (cell.field.capacity == "_unique value")
	{
		var itemsDiv = sectionObj.append("div").classed("items-div string-unique-item", true);

		sectionObj.classed("border-below unique-cell", true);
		var divs = itemsDiv.selectAll("li")
			.data(cell.data)
			.enter()
			.append("li")
			.classed("string-input-container", true);	// So that each item appears on its own row.
	
		divs.append("input")
			.classed("string-unique-input", true)
			.attr("type", inputType)
			.attr("placeholder", cell.field.name)
			.property("value", _getDataValue);

		if (cell.field.descriptorType != "_by text")
		{
			var labelDiv = sectionObj.insert("div", ":first-child").classed("cell-label string-unique-input-label", true)
				.text(cell.field.name);
			labelDiv
				.style("line-height", divs.selectAll("input").style("line-height"));
			
			divs.selectAll("input").classed("string-unique-labeled-input", "true")
		}
	}
	else
	{
		sectionObj.classed("multiple-values-cell", true);
		sectionObj.append("div").classed("cell-label top-label", true)
			      .text(cell.field.name);
		var itemsDiv = sectionObj.append("div")
			.classed("items-div border-above border-below", true);

		var divs = appendItems(itemsDiv, cell.data);
		
		var appendControls = function(divs, cell)
		{	
			appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
			
			/* Inner layer needed so that padding is applied to inner content but not 
				confirm delete control
			 */
			var innerDivs = divs.append("div")
				.classed("multi-row-content", true);
		
			appendDeleteControls(innerDivs);

			inputContainers = innerDivs.append("div")
				.classed("string-input-container string-multi-value-container", true);						
	
			inputContainers.append("input")
				.classed("string-input", true)
				.attr("type", inputType)
				.attr("placeholder", cell.field.name)
				.property("value", _getDataValue);
		}
		
		appendControls(divs, cell);

		_setupEditItemsDivHandlers(itemsDiv, cell);
		$(itemsDiv.node()).on("valueAdded.cr", function(e, newData)
			{
				var div = d3.select(this).append("li")
					.datum(newData);
				
				appendControls(div, cell);	
			});
			
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(cell) {
				if (prepareClick())
				{
					showClickFeedback(this);
				
					var newData = cell.addNewValue();
				
					unblockClick();
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add " + cell.field.name);
	}
}

/* Produces a function which adds new value view to a container view
	when the new data is added.
	the viewFunction is called when the item is clicked.
	the successfunction is called when the viewFunction succeeds.
 */
function _getOnValueAddedFunction(panelDiv, cell, containerUUID, canDelete, canShowDetails, viewFunction, successFunction)
{
	return function(e, newData)
	{
		var itemsDiv = d3.select(this);
	
		var divs = appendItem(itemsDiv, newData);
		_checkItemsDivDisplay(itemsDiv, cell);
		
		/* Hide the new button if it is blank, and then show it if the data changes. */
		divs.style("display", 
				   (cell.field.capacity == "_unique value" || newData.getValueID()) ? "block" : "none");
				   
		if (cell.field.capacity != "_unique value")
		{
			newData.addTarget("dataChanged.cr", divs.node());
			$(divs.node()).on("dataChanged.cr", function(e) {
					d3.select(this).style("display", 
					   newData.getValueID() || newData.value.cells.length > 0 ? "block" : "none");
				});
		}

		if (canDelete && cell.field.capacity != "_unique value")
			appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
		
		var buttons = appendRowButtons(divs, cell);

		buttons.on("click", function(d) {
			if (prepareClick())
			{
				var cell = itemsDiv.datum();
				viewFunction(d, cell, containerUUID, panelDiv, successFunction);
			}
		});
		if (canDelete && cell.field.capacity != "_unique value")
			appendDeleteControls(buttons);
		if (canShowDetails)
			appendRightChevrons(buttons);

		appendButtonDescriptions(buttons, cell)
			.each(_pushTextChanged);
	}
}

function appendRowButtons(divs, cell)
{
	return divs.append("div")
			.classed("btn row-button multi-row-content expanding-div", !cell || cell.field.capacity != "_unique value");
}

function appendConfirmDeleteControls(divs)
{
	divs.classed("delete-confirm-container", true)
		.each(function(d)
		{
			$(this).on("valueDeleted.cr", function(e, newData)
			{
				$(this).animate({height: "0px"}, 200, 'swing', function() { $(this).remove(); });
			});
			d.addTarget("valueDeleted.cr", this);
		});						
	
	return divs.append("button")
		.classed("delete-confirm-button right-fixed-width-div", true)
		.text("Delete")
		.style("width", "0px")
		.style("padding-left", "0px")
		.style("padding-right", "0px")
		.on('blur', function(e)
		{
			var deleteButton = $($(this).parents()[0]).children(".row-button").children(".glyphicon-minus-sign");
			deleteButton.animateRotate(180, 90, 400);
			$(this).animate({width: "0px", "padding-left": "0px", "padding-right": "0px"},
				400);
		});
}

function appendDeleteControls(buttons)
{
	buttons.append("button")
		.classed("glyphicon glyphicon-minus-sign pull-left", true)
		.on("click", function(e)
		{
			if (prepareClick())
			{
				$(this).animateRotate(90, 180, 600, 'swing');
				var confirmButton = $($(this).parents(".delete-confirm-container")[0]).children(".delete-confirm-button");
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
	buttons.append("span")
		.classed("site-chevron-right right-fixed-width-div right-vertical-chevron pull-right", true)
		.append("img")
		.attr("src", rightChevronPath)
		.attr("height", "18px");
}

function appendLeftChevrons(buttons)
{
	return buttons.append("span")
		.append("img")
		.attr("src", leftChevronPath)
		.attr("height", "22px")
		.style("margin-top", "-3px")
		.style("margin-right", "-6px");
}

/* This function appends the descriptions of each object to the button. */
function appendButtonDescriptions(buttons, cell)
{
	return buttons.append("span")
		.classed("description-text string-value-view expanding-div", true)
		.classed("string-multi-value-container pull-left", !cell || cell.field.capacity != "_unique value")
		.text(_getDataDescription);
}

function _showViewObjectCell(obj, containerPanel, cell, containerUUID)
{
	var sectionObj = d3.select(obj);
	
	var labelDiv = sectionObj.append("div").classed("cell-label", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		sectionObj.classed("unique-cell", true);
		labelDiv.classed("left-label left-fixed-width", true);
		itemsDiv.classed("right-label expanding-div", true);
		if (!_isPickCell(cell))
			sectionObj.classed("btn row-button unique-row-button", true)
			          .on("click", function(cell) {
				if (prepareClick())
				{
					showViewObjectPanel(cell.data[0], cell, containerUUID, containerPanel, revealPanelLeft);
				}
			});
	}
	else
	{
		sectionObj.classed("multiple-values-cell", true);
		labelDiv.classed("top-label", true);
	}

	_setupItemsDivHandlers(itemsDiv, cell);
	$(itemsDiv.node()).on("valueAdded.cr", _getOnValueAddedFunction(containerPanel, cell, containerUUID, false, !_isPickCell(cell), showViewObjectPanel, revealPanelLeft));
	
	var clickFunction;
	if (_isPickCell(cell) || cell.field.capacity == "_unique value")	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
			if (prepareClick())
			{
				showViewObjectPanel(d, cell, containerUUID, containerPanel, revealPanelLeft);
			}
		}

	var divs = appendItems(itemsDiv, cell.data);
	
	var buttons;
	if (!_isPickCell(cell)) {
		buttons = appendRowButtons(divs, cell);
	
		if (clickFunction)
			buttons.on("click", clickFunction);
		
		appendRightChevrons(buttons);
	}
	else
	{
		buttons = divs.append("div").classed("multi-line-item", cell.field.capacity != "_unique value");
	}
	
	appendButtonDescriptions(buttons, cell)
		.each(_pushTextChanged);
}

function _showEditObjectCell(obj, panelDiv, cell, parent, storeDataFunction)
{
	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true);
	
	var labelDiv = sectionObj.append("div").classed("cell-label", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		sectionObj.classed("unique-cell btn row-button unique-row-button border-below", true);
		labelDiv.classed("left-label left-fixed-width", true);
		itemsDiv.classed("right-label expanding-div", true);
		sectionObj.on("click", function(cell) {
			if (prepareClick())
			{
				if (_isPickCell(cell))
					showPickObjectPanel(cell.data[0], cell, parent.getValueID(), panelDiv);
				else
					showEditObjectPanel(cell.data[0], cell, parent.getValueID(), panelDiv, revealPanelLeft);
			}
		});
	}
	else
	{
		sectionObj.classed("multiple-values-cell", true);
		labelDiv.classed("top-label", true);
		itemsDiv.classed("border-above", true);
	}

	_setupItemsDivHandlers(itemsDiv, cell);
	$(itemsDiv.node()).on("valueAdded.cr", _getOnValueAddedFunction(panelDiv, cell, parent.getValueID(), true, true, showEditObjectPanel, revealPanelLeft));

	var clickFunction;
	if (cell.field.capacity == "_unique value")	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
				if (prepareClick())
				{
					if (_isPickCell(cell))
						showPickObjectPanel(d, cell, parent.getValueID(), panelDiv);
					else
						showEditObjectPanel(d, cell, parent.getValueID(), panelDiv, revealPanelLeft);
				}
			};
		
	var divs = appendItems(itemsDiv, cell.data);
	
	if (cell.field.capacity != "_unique value")
		appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
		
	var buttons = appendRowButtons(divs, cell);

	if (clickFunction)
		buttons.on("click", clickFunction);
	
	if (cell.field.capacity != "_unique value")
		appendDeleteControls(buttons);

	appendRightChevrons(buttons);	
		
	appendButtonDescriptions(buttons, cell)
		.each(_pushTextChanged);
	
	if (cell.field.capacity != "_unique value")
	{
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(cell) {
				if (prepareClick())
				{
					var newValue = cell.addNewValue();
					
					if (_isPickCell(cell))
						showPickObjectPanel(newValue, newValue.cell, parent.getValueID(), panelDiv)
					else
						showEditObjectPanel(newValue, newValue.cell, parent.getValueID(), panelDiv, revealPanelUp);
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add " + cell.field.name);
	}
}

function _appendUpdateStringCommands(sectionObj, cell, objectData, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("input").each(function(d, i)
		{
			if (d.id)
			{
				/* Check to ensure that the values are different and at least one of them
					is not null.
				 */
				if (this.value != d.value && (this.value || d.value))
				{
					initialData.push({id: d.id, value: this.value});
					sourceObjects.push(d);
				}
			}
			else
			{
				/* Check to ensure that the values are different and at least one of them
					is not null.
				 */
				if (this.value != d.value && (this.value || d.value))
				{
					var command;
					command = {containerUUID: objectData.getValueID(), 
							   fieldID: cell.field.nameID, 
							   value: this.value,
							   index: i};
					initialData.push(command);
					sourceObjects.push(d);
				}
			}
		}
	);
}

function _appendUpdateDatestampCommands(sectionObj, cell, objectData, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("input").each(function(d, i)
		{
			var newValue;
			try
			{
				if (!this.value)
					newValue = undefined;
				else
					newValue = (new Date(this.value)).toISOString().substring(0, 10);
			}
			catch(err)
			{
				newValue = undefined;
			}
			
			/* If both are null, then they are equal. */
			if (!newValue && !d.value)
				newValue = d.value;
				
			if (newValue != d.value)
			{
				if (d.id)
				{
					initialData.push({id: d.id, value: newValue});
					sourceObjects.push(d);
				}
				else
				{
					var command;
					command = {containerUUID: objectData.getValueID(), 
							   fieldID: cell.field.nameID, 
							   value: newValue,
							   index: i};
					initialData.push(command);
					sourceObjects.push(d);
				}
			}
		}
	);
}

function _appendUpdateTimeCommands(sectionObj, cell, objectData, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll("input").each(function(d, i)
		{
			var newValue;
			try
			{
				if (!this.value)
					newValue = undefined;
				else
					newValue = Date.parse(this.value).toString("HH:mm");
			}
			catch(err)
			{
				newValue = undefined;
			}
			
			/* If both are null, then they are equal. */
			if (!newValue && !d.value)
				newValue = d.value;
				
			if (newValue != d.value)
			{
				if (d.id)
				{
					initialData.push({id: d.id, value: newValue});
					sourceObjects.push(d);
				}
				else
				{
					var command;
					command = {containerUUID: objectData.getValueID(), 
							   fieldID: cell.field.nameID, 
							   value: newValue,
							   index: i};
					initialData.push(command);
					sourceObjects.push(d);
				}
			}
		}
	);
}

function _appendUpdateObjectCommands(sectionObj, cell, objectData, initialData, sourceObjects)
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
				var newDatum = {id: null, value: {cells: []}};
				$(d.value.cells).each(function()
				{
					cr.dataTypes[this.field.dataType].appendCell(this, newDatum.value.cells);
				});
				{
					var command;
					command = {containerUUID: objectData.getValueID(), 
							   fieldID: cell.field.nameID, 
							   ofKindID: cell.field.ofKindID,
							   value: newDatum.value,
							   index: i};
					initialData.push(command);
					sourceObjects.push(d);
				}
			}
		}
	);
}

function _updateStringCell(sectionObj, cell)
{
	d3.select(sectionObj).selectAll("input").each(function(d)
		{
			if (this.value != d.value)
			{
				d.value = this.value;
			}
		}
	);
}

function _updateDatestampCell(sectionObj, cell)
{
	d3.select(sectionObj).selectAll("input").each(function(d)
		{
			var newValue;
			try
			{
				if (!this.value)
					newValue = undefined;
				else
					newValue = (new Date(this.value)).toISOString().substring(0, 10);
			}
			catch(err)
			{
				newValue = undefined;
			}
			
			/* If both are null, then they are equal. */
			if (!newValue && !d.value)
				newValue = d.value;

			if (newValue != d.value)
			{
				d.value = newValue;
			}
		}
	);
}

function _updateTimeCell(sectionObj, cell)
{
	d3.select(sectionObj).selectAll("input").each(function(d)
		{
			var newValue;
			try
			{
				if (!this.value)
					newValue = undefined;
				else
					newValue = Date.parse(this.value).toString("HH:mm");
			}
			catch(err)
			{
				newValue = undefined;
			}
			
			/* If both are null, then they are equal. */
			if (!newValue && !d.value)
				newValue = d.value;

			if (newValue != d.value)
			{
				d.value = newValue;
			}
		}
	);
}

function _updateObjectCell(sectionObj, cell)
{
	/* Do nothing at the moment. */
}

/* This is a storeDataFunction for adding an object within an unsaved object. */
function _storeNewInstance(oldValue, containerCell, containerUUID, sections, onSuccessFunction)
{
	closealert();
	var newData = cr.dataTypes._object.newValue();
	newData.value.cells = [];
	sections.each(
		function(cell) {
			if ("updateCell" in dataTypeViews[cell.field.dataType])
				dataTypeViews[cell.field.dataType].updateCell(this, cell);
			newData.importCell(cell);
		});
		
	newData.calculateDescription();
	if (oldValue)
	{
		/* Replace the new data into the oldValue, which has already been added. */
		oldValue.value = newData.value;
		oldValue.triggerEvent("dataChanged.cr");
	}
	else
		containerCell.addValue(newData);
	if (onSuccessFunction) onSuccessFunction(newData);
}

/* This is a storeDataFunction for creating an object. 
	If this is a root object, then containerUUID will be null.
 */
function _submitCreateInstance(oldValue, containerCell, containerUUID, sections, onSuccessFunction)
{
	var initialData = {}
	sections.each(
		function(cell) {
			dt = dataTypeViews[cell.field.dataType]
			if ("updateCell" in dt)
				dt.updateCell(this, cell);
			cr.dataTypes[cell.field.dataType].appendData(cell, initialData);
		});
		
	cr.append(oldValue, containerCell, containerUUID, initialData, onSuccessFunction, syncFailFunction)
}

var dataTypeViews = {
	_string: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "text");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "text");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell,
	},
	_number: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "number");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "number");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell
	},
	_email: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "email");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "email");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell
	},
	_url: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "url");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "url");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell
	},
	_telephone: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "tel");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "tel");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell
	},
	_datestamp: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "date");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "date");
		},
		appendUpdateCommands: _appendUpdateDatestampCommands,
		updateCell: _updateDatestampCell,
	},
	_time: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "time");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			_showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "time");
		},
		appendUpdateCommands: _appendUpdateTimeCommands,
		updateCell: _updateTimeCell,
	},
	_object: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			_showViewObjectCell(obj, containerPanel, cell, containerUUID);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			/* If containerUUID is null during an edit operation, then the container
				is new and was not saved. */
			if (parent.getValueID())
				_showEditObjectCell(obj, containerPanel, cell, parent, _submitCreateInstance);
			else
				_showEditObjectCell(obj, containerPanel, cell, parent, _storeNewInstance);
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			/* If containerUUID is null, then the object being added is either within a new root object
				or an object contained within an item that wasn't saved. In either case, 
				store any item added to this cell as part of the data of the cell.
			 */
			_showEditObjectCell(obj, containerPanel, cell, parent, _storeNewInstance);
		},
		appendUpdateCommands: _appendUpdateObjectCommands,
		updateCell: _updateObjectCell
	},
};

function appendDescriptions(buttons)
{
	buttons.append("span")
		.classed("description-text pull-left", true)
		.text(_getDataDescription)
		.each(_pushTextChanged);
}

function appendButtons(panelDiv, rootObjects, buttonClicked, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;
	
	var itemsDiv = panelDiv.append("ol")
		.classed("items-div border-above", true);

	var sections = itemsDiv.selectAll("li")
				.data(rootObjects)
				.enter()
				.append("li")
				.classed("border-below", true);

	var buttons = appendViewButtons(sections, fill)
		.on("click", buttonClicked);
}

/* Append a set of buttons to each div for displaying the text for each item. */
function appendViewButtons(divs, fill)
{
	fill = typeof fill !== 'undefined' ? fill : appendDescriptions;

	var buttons = divs.append("div").classed("btn row-button multi-row-content expanding-div", true);
	
	fill(buttons);
		
	return buttons;
}

function appendItems(container, data)
{
	// Remove any lingering contents from the set of full issues.
	container.selectAll("li").remove();

	return container.selectAll("li")
		.data(data)
		.enter()
		.append("li")	// So that each button appears on its own row.
		.each(_setupItemHandlers);
}

function appendItem(container, data)
{
	return container
		.append("li")	// So that each button appears on its own row.
		.datum(data)
		.each(_setupItemHandlers);
}

/* Returns the set of objects that contain the description of each data element */
function appendViewCellItems(container, cell, clickFunction)
{
	var divs = appendItems(container, cell.data);
	
	var buttons = appendRowButtons(divs, cell);
	
	buttons.append("span")
		.classed("description-text pull-left", true)
		.text(_getDataDescription)
		.each(_pushTextChanged);
		
	buttons.on("click", clickFunction);
	appendRightChevrons(buttons);
	
	return buttons;
}

/* Returns the set of objects that contain the description of each data element */
function appendEditCellItems(container, cell, clickFunction)
{
	var divs = appendItems(container, cell.data);
	
	if (cell.field.capacity != "_unique value")
		appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
	
	var buttons = appendRowButtons(divs, cell);
	
	if (cell.field.capacity != "_unique value")
		appendDeleteControls(buttons);
	appendRightChevrons(buttons);

	appendButtonDescriptions(buttons, cell)
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

/* From the specified configuration array of objects, get the objects in index order. 
	Indexes are retrieved using the getIndex function.*/
/* Creates a panel that sits atop the specified containerPanel in the same container. */
function createPanel(containerPanel, datum, headerText)
{
	if (isNaN(parseInt(containerPanel.style("z-index"))))
		throw "containerPanel's z-index is not specified";
		
	var rootPanel = d3.select($(containerPanel.node()).parents()[0]);
	var zindex = parseInt(containerPanel.style("z-index"))+1;
	var panelDiv = rootPanel
					.append("panel")
					.classed("configuration-panel site-panel", true)
					.style("z-index", zindex)
					.datum(datum)
					.attr("headerText", headerText);
	
	panelDiv.appendNavContainer = function()
	{
		var navContainer = this.append("nav").classed("navbar navbar-default site-navbar always-visible", true)
					.attr("role", "navigation")
					.append("div")
					.classed("container-fluid", true);
					
		navContainer.appendLeftButton = function()
		{
			return this.append("div").classed("pull-left", true)
					   .append("div") .classed("site-navbar-link site-active-text", true);
		}
	
		navContainer.appendRightButton = function()
		{
			return this.append("div").classed("pull-right", true)
					   .append("div") .classed("site-navbar-link site-active-text", true);
		}
		
		navContainer.appendTitle = function(newTitle)
		{
			var h = this.append("div").classed("site-navbar-commands", true)
					   .append("div").classed("site-title", true)
					   .text(newTitle);
			h.style("width", (getTextWidth(newTitle, h.style("font"))+1).toString() + "px")
			return h;
		}
	
		return navContainer;
	}
	
	panelDiv.appendSearchBar = function(textChanged)
	{
		var searchBarDiv = this.append("div").classed("searchbar always-visible", true);
		return setupSearchBar(searchBarDiv.node(), textChanged)
	}
	
	panelDiv.appendScrollArea = function()
	{
		var panel2Div = this.append("div").classed("panel-fill vertical-scrolling", true);
		
		panel2Div.appendHeader = function()
		{
			return this.append("header").classed("configuration-header", true)
				.text(headerText);
		}
		
		panel2Div.appendAlertContainer = function()
		{
			return this.append("div").classed("alert-container", true);
		}
	
		panel2Div.appendSections = function(sectionData)
		{
			return panel2Div
					.selectAll("section")
					.data(sectionData)
					.enter()
					.append("section");
		}
		panel2Div.resetHeight = function()
		{
			var newHeight = window.innerHeight;
			panelDiv.selectAll(".always-visible").each(
				function() { newHeight -= $(this).height(); }
			);
			$(panel2Div.node()).height(newHeight);
		}
		
		panel2Div.show_view_cells = function(objectData, cell, containerUUID, panelDiv)
		{
			this.appendSections(objectData.value.cells)
				.classed("cell-div", true)
				.each(function(cell) {
						if (cell.field.descriptorType != "_by text")
						{
							dataTypeViews[cell.field.dataType].show(this, panelDiv, cell, containerUUID);
							if (!cell.isEmpty())
								$(this).css("display", "block");
							else
								$(this).css("display", "none");
						
							/* Make sure the section gets shown if a value is added to it. */
							cell.addTarget("valueAdded.cr", this);
							$(this).on("valueAdded.cr", function(e, newData) {
								$(this).css("display", "block");
							});
							
							cell.addTarget("valueDeleted.cr", this);
							$(this).on("valueDeleted.cr", function(e, newData) {
								if (!cell.isEmpty())
									$(this).css("display", "block");
								else
									$(this).css("display", "none");
							});
							
							$(this).on("dataChanged.cr", function(e) {
								$(this).css("display", "block");
							});
						}
					})
				.append("div").classed("cell-border-below", 
					function(cell) { return cell.field.descriptorType != "_by text" } );
		}
		
		panel2Div.show_edit_cells = function(objectData, cell, panelDiv)
		{
			this.appendSections(objectData.value.cells)
				.each(function(cell) {
						dataTypeViews[cell.field.dataType].showEdit(this, panelDiv, cell, objectData);
					});
		}
		
		$(window).resize(panel2Div.resetHeight);
		
		return panel2Div;
	}

	return panelDiv;
}

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
			.classed("site-disabled-text", this.value.length == 0)
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
	
	$(document).ready(function(e) { resizeSearchCancelHeight() });
	$(window).resize(function(e) { resizeSearchCancelHeight() });
	resizeSearchCancelHeight();
	
	return searchInput.node();
}

/* Gets the text for the header of a view panel based on the specified data. */
function getViewPanelHeader(objectData, containerCell)
{
	var headerText = objectData.getDescription();
	if (!objectData.hasTextDescription())
	{
		if (headerText.length > 0)
			headerText = containerCell.field.name + " (" + headerText + ")";
		else
			headerText = containerCell.field.name;
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
function showViewOnlyObjectPanel(objectData, containerCell, containerUUID, containerPanel) {
	successFunction = function ()
	{
		var panelDiv = createPanel(containerPanel, 
									objectData, getViewPanelHeader(objectData, containerCell))
			.classed("show-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("span").text(" " + containerPanel.attr("headerText"));
	
		var panel2Div = panelDiv.appendScrollArea();

		var headerDiv = panel2Div.appendHeader();

		panel2Div.appendAlertContainer();
							
		showPanelLeft(panelDiv.node());
	
		panel2Div.append("div").classed("cell-border-below", true);
		panel2Div.show_view_cells(objectData, containerCell, containerUUID, panelDiv);
	}
	
	objectData.checkCells(containerCell, undefined, successFunction, syncFailFunction)
}

/* Displays a panel in which the specified object's contents appear.
 */
function showViewObjectPanel(objectData, containerCell, containerUUID, containerPanel, showSuccessFunction) {
	successFunction = function ()
	{
		var panelDiv = createPanel(containerPanel, 
									objectData, getViewPanelHeader(objectData, containerCell))
			.classed("show-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("span").text(" " + containerPanel.attr("headerText"));
	
		var editButton = navContainer.appendRightButton()
			.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
				
					showEditObjectPanel(objectData, containerCell, containerUUID, panelDiv, revealPanelUp);
				}
				d3.event.preventDefault();
			});
		editButton.append("span").text("Edit");
	
		var panel2Div = panelDiv.appendScrollArea();

		var headerDiv = panel2Div.appendHeader();
		objectData.addTarget("dataChanged.cr", headerDiv.node());
		$(headerDiv.node()).on("dataChanged.cr", function(e) {
				var newText = getViewPanelHeader(objectData, containerCell);
				panelDiv.attr("headerText", newText);
				d3.select(this).text(newText);
			});

		panel2Div.appendAlertContainer();
							
		panel2Div.append("div").classed("cell-border-below", true);
		panel2Div.show_view_cells(objectData, containerCell, containerUUID, panelDiv);
		
		showSuccessFunction(panelDiv.node());
	}
	
	objectData.checkCells(containerCell, undefined, successFunction, syncFailFunction)
}

function _b64_to_utf8( str ) {
    str = str.replace(/\s/g, '');    
    return decodeURIComponent(escape(window.atob( str )));
}

/* 
	Displays a panel for editing the specified object. 
 */
function showEditObjectPanel(objectData, containerCell, containerUUID, containerPanel, showSuccessFunction) {
	if (!objectData)
		throw "objectData is not initialized";
		
	var successFunction = function()
	{
		var header;
		if (objectData.getValueID())
			header = "Edit";
		else
			header = "New " + objectData.cell.field.name;
			
		var panelDiv = createPanel(containerPanel, objectData, header)
						.classed("edit-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var panel2Div = panelDiv.appendScrollArea();
		panel2Div.appendAlertContainer();
		panel2Div.show_edit_cells(objectData, containerCell, panelDiv);

		var doneButton;
		var hideSuccessFunction;
		if (showSuccessFunction == revealPanelUp)
		{
			hideSuccessFunction = function()
				{
					hidePanelDown($(doneButton.node()).parents(".site-panel")[0]);
				};
		}
		else
		{
			hideSuccessFunction = function()
				{
					hidePanelRight($(doneButton.node()).parents(".site-panel")[0]);
				};
		}
		if (objectData.getValueID())
		{
			if (showSuccessFunction == revealPanelUp)
				doneButton = navContainer.appendRightButton();
			else
				doneButton = navContainer.appendLeftButton();
			doneButton.append("span").text("Done");
			doneButton.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
			
					var sections = panel2Div.selectAll("section");
					var initialData = [];
					var sourceObjects = [];
					sections.each(function(cell) {
							if ("appendUpdateCommands" in dataTypeViews[cell.field.dataType])
								dataTypeViews[cell.field.dataType].appendUpdateCommands(this, cell, objectData, initialData, sourceObjects);
						});
					var updateValuesFunction = function()
					{
						sections.each(function(cell) {
								if ("updateCell" in dataTypeViews[cell.field.dataType])
									dataTypeViews[cell.field.dataType].updateCell(this, cell);
							});
					}
					if (initialData.length > 0) {
						cr.updateValues(initialData, sourceObjects, updateValuesFunction, hideSuccessFunction, syncFailFunction);
					}
					else
					{
						hideSuccessFunction();
					}
				}
				d3.event.preventDefault();
			});
		}
		else
		{
			doneButton = navContainer.appendRightButton();
			doneButton.append("span").text("Add");
			doneButton.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
			
					var sections = panel2Div.selectAll("section");
					if (containerCell.parent == null)
					{
						_submitCreateInstance(objectData, containerCell, null, sections, hideSuccessFunction);
						/* Add this new root object. */
					}
					else if (containerCell.parent.getValueID())
					{
						_submitCreateInstance(objectData, containerCell, containerCell.parent.getValueID(), sections, hideSuccessFunction);
						/* Add this item to the contained object. */
					}
					else
					{
						/* In this case, we are editing an object that is contained in an object
							that hasn't been saved. */
						objectData.value.cells = [];
						sections.each(
							function(cell) {
								if ("updateCell" in dataTypeViews[cell.field.dataType])
									dataTypeViews[cell.field.dataType].updateCell(this, cell);
								objectData.importCell(cell);
							});
		
						objectData.calculateDescription();
						objectData.triggerEvent("dataChanged.cr");
						hideSuccessFunction();
					}
				}
				d3.event.preventDefault();
			});
			var backButton = navContainer.appendLeftButton()
				.on("click", function()
				{
					if (prepareClick())
					{
						if (objectData.cell.field.maxCapacity != "_unique value")
						{
							// In this case, delete the item on cancel. 
							objectData.cell.deleteValue(objectData);
						}
						hideSuccessFunction();
					}
					d3.event.preventDefault();
				});
			backButton.append("span").text("Cancel");
		}
		navContainer.appendTitle(header);

		$(panelDiv.node()).on('dragover',
			function(e) {
				e.preventDefault();
				e.stopPropagation();
			}
		)
		$(panelDiv.node()).on('dragenter',
			function(e) {
				e.preventDefault();
				e.stopPropagation();
			}
		)
		$(panelDiv.node()).on('drop', function(e)
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
														if (cell.field.name == name)
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
		
		showSuccessFunction(panelDiv.node());
	}
	
	if (objectData.getValueID())
		objectData.checkCells(containerCell, undefined, successFunction, syncFailFunction);
	else
		objectData.checkConfiguration(successFunction, syncFailFunction);
}

function getViewRootObjectsFunction(cell, containerPanel, header, sortFunction, successFunction)
{
	return function(rootObjects)
	{
		if (sortFunction)
			rootObjects.sort(sortFunction);
			
		for (var i = 0; i < rootObjects.length; i++)
			cell.pushValue(rootObjects[i]);
		
		var panelDiv = createPanel(containerPanel, cell, header)
			.classed("list-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");
		
		var editButton = navContainer.appendRightButton()
			.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
				
					showEditRootObjectsPanel(cell, panelDiv, "Edit " + header, sortFunction);
				}
				d3.event.preventDefault();
			});
		editButton.append("span").text("Edit");
		
		navContainer.appendTitle(header);
		
		function textChanged(){
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", "block");
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return "block";
							else
								return "none";
						});
			}
		}
	
		var searchBar = panelDiv.appendSearchBar(textChanged);

		var panel2Div = panelDiv.appendScrollArea();
		panel2Div.appendAlertContainer();
		
		var itemsDiv = panel2Div.append("section")
			.classed("items-div border-above", true)
			.datum(cell);
		
		_setupItemsDivHandlers(itemsDiv, cell);
		itemsDiv.node().onValueAdded = _getOnValueAddedFunction(panelDiv, cell, null, false, true, showViewObjectPanel, revealPanelLeft);
		$(itemsDiv.node()).on("valueAdded.cr", function(e, newData)
		{
			this.onValueAdded(e, newData);
			if (sortFunction)
			{
				itemsDiv.selectAll("li").sort(sortFunction);
				cell.data.sort(sortFunction);
			}
		});
		$(itemsDiv.node()).on("dataChanged.cr", function(e, newData)
		{
			if (sortFunction)
			{
				itemsDiv.selectAll("li").sort(sortFunction);
				cell.data.sort(sortFunction);
			}
		});

		appendViewCellItems(itemsDiv, cell, 
			function(d) {
				if (prepareClick())
				{
					showViewObjectPanel(d, cell, null, panelDiv, revealPanelLeft);
				}
			});

		if (successFunction)
			successFunction(panelDiv.node());
	}
}

function showEditRootObjectsPanel(cell, containerPanel, header, sortFunction)
{
	var panelDiv = createPanel(containerPanel, cell, header)
		.classed("list-panel", true);

	var navContainer = panelDiv.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", handleCloseDownEvent);
	backButton.append("span").text("Done");
	
	var addButton = navContainer.appendRightButton()
		.classed("add-button", true)
		.on("click", function(d) {
			if (prepareClick())
			{
				showClickFeedback(this);
			
				var newValue = cell.addNewValue();
				showEditObjectPanel(newValue, newValue.cell, null, panelDiv, revealPanelUp);
			}
			d3.event.preventDefault();
		});
	addButton.append("span").text("+");
	navContainer.appendTitle(header);	
	
	var textChanged = function(){
		var val = this.value.toLocaleLowerCase();
		if (val.length == 0)
		{
			/* Show all of the items. */
			panel2Div.selectAll("li")
				.style("display", "block");
		}
		else
		{
			/* Show the items whose description is this.value */
			panel2Div.selectAll("li")
				.style("display", function(d)
					{
						if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
							return "block";
						else
							return "none";
					});
		}
	}

	var searchBar = panelDiv.appendSearchBar(textChanged);

	var panel2Div = panelDiv.appendScrollArea();
	panel2Div.appendAlertContainer();
	
	var itemsDiv = panel2Div.append("section")
		.classed("items-div border-above", true)
		.datum(cell);

	_setupItemsDivHandlers(itemsDiv, cell);
	itemsDiv.node().onValueAdded = _getOnValueAddedFunction(panelDiv, cell, null, true, true, showEditObjectPanel, revealPanelLeft);
	$(itemsDiv.node()).on("valueAdded.cr", function(e, newData)
	{
		this.onValueAdded(e, newData);
		if (sortFunction)
			itemsDiv.selectAll("li").sort(sortFunction);
	});
	$(itemsDiv.node()).on("dataChanged.cr", function(e, newData)
	{
		if (sortFunction)
			itemsDiv.selectAll("li").sort(sortFunction);
	});

	appendEditCellItems(itemsDiv, cell, 
		function(d) {
			if (prepareClick())
			{
				showEditObjectPanel(d, cell, null, panelDiv, revealPanelLeft);
			}
		});

	$(panelDiv.node()).on('dragover',
		function(e) {
			e.preventDefault();
			e.stopPropagation();
		}
	)
	$(panelDiv.node()).on('dragenter',
		function(e) {
			e.preventDefault();
			e.stopPropagation();
		}
	)
	$(panelDiv.node()).on('drop', function(e)
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
	
	showPanelUp(panelDiv.node());
}

/* Displays a panel from which a user can select an object of the kind required 
	for objects in the specified cell.
	containerUUID is the id of the instance that contains the specified cell.
 */
function showPickObjectPanel(oldData, cell, containerUUID, containerPanel) {
	if (!oldData)
		throw "oldData is not defined";
		
	var failFunction = syncFailFunction;
	
	function _storeUnsavedPickedValue(oldData, newData)
	{
		/* In this case, we are replacing an old value for
		   an item that was added to the item but not saved;
		   a placeholder or a previously picked value.
		 */
		if (newData.getValueID() != oldData.getValueID()) {
			oldData.completeUpdateValue(newData);
		}
	}

	function selectAllSuccessFunction(rootObjects) {
		if (!("pickObjectPath" in cell.field && cell.field.pickObjectPath))
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
			panelDatum = cell;		/* Adding a new object. */
		var panelDiv = createPanel(containerPanel, panelDatum, cell.field.name)
			.classed("list-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					if (!oldData.getValueID() && cell.field.maxCapacity != "_unique value")
					{
						// In this case, delete the item on cancel. 
						cell.deleteValue(oldData);
					}
					hidePanelRight($(this).parents(".site-panel")[0]);
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
		
		var textChanged = function(){
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", "block");
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return "block";
							else
								return "none";
						});
			}
		}
	
		var searchBar = panelDiv.appendSearchBar(textChanged);

		var panel2Div = panelDiv.appendScrollArea();
		panel2Div.appendHeader();
		panel2Div.appendAlertContainer();
		
		function buttonClicked(d) {
			var successFunction = function()
			{
				hidePanelRight(panelDiv.node());
			}
			
			if (prepareClick())
			{
				if (oldData.id != null)
				{
					if (d.getValueID() == oldData.getValueID()) {
						successFunction();
					}
					else
					{
						cr.updateObjectValue(oldData, d, successFunction, failFunction);
					}
				}
				else if (containerUUID)	/* In this case, we are adding an object to an existing object. */
				{
					cr.addObjectValue(cell, containerUUID, d, 
						successFunction,
						failFunction);
				}
				else 
				{
					_storeUnsavedPickedValue(oldData, d);
					successFunction();
				}
			}
			d3.event.preventDefault();
		}
		
		var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
		
		buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
			function(d) { return d.getDescription() == oldData.getDescription(); });
	
		showPanelLeft(panelDiv.node());
	}
	
	if (cell.field.pickObjectPath)
	{
		pickObjectPath = cell.field.pickObjectPath;
		if (pickObjectPath.indexOf("parent") == 0 &&
			">:=<".indexOf(pickObjectPath.charAt(6)) > 0)
		{
			var currentObject = cell.parent;
			pickObjectPath = pickObjectPath.slice(6);
			while (currentObject != null &&
				   pickObjectPath.indexOf("::reference(") == 0 &&
				   !currentObject.getValueID())
			{
				currentObject = currentObject.cell.parent;
				pickObjectPath = pickObjectPath.slice("::reference(".length);
				/* While the next string is quoted, skip it. */
				while (pickObjectPath[0] == '"')
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
				cr.selectAll({path: pickObjectPath, done: selectAllSuccessFunction, fail: failFunction});
			}
			else
				failFunction("The container has not yet been saved.");
		}
		else	
			cr.selectAll({path: pickObjectPath, done: selectAllSuccessFunction, fail: failFunction});
	}
	else
		cr.selectAll({path: cell.field.ofKindID, done: selectAllSuccessFunction, fail: failFunction});
}
		
