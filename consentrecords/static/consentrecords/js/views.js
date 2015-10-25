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
	unblockClick();
}

/* A default function used to report an error during an asynchronous operation
	without unblocking a user event. */
function asyncFailFunction(error)
{
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
	$(panelNode).offset({top: window.innerHeight, left: 0})
				   .height(0)
				   .width("100%")
				   .css("display", "block")
				   .trigger("revealing.cr")
				   .animate({height: "100%", top: 0}, 400, "swing",
						function() {
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
	$(panelNode).offset({top: 0, left: 0})
				.height("100%")
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
	$(panelNode).animate({top: window.innerHeight}, 400, "swing", 
		function() {
			if (doRemove)
				$(this).remove();
			unblockClick();
		});
}

function hidePanelRight(panelNode, doRemove)
{
	doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
	closealert();
	$(panelNode).trigger("hiding.cr");
	$(panelNode).hide("slide", {direction: "right"}, 400, 
		function() {
			if (doRemove)
				$(this).remove();
			unblockClick();
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

function isPickCell(cell)
{
	if (("_object add rule" in cell.field) &&
			 (cell.field["_object add rule"] == "_pick one" ||
			  cell.field["_object add rule"] == "_pick or create one"))
		return true;
	else
		return false;
}

function pushTextChanged(d) {
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

getDataValue = function(d) { return d.value; }
getDataDescription = function(d) { return d.getDescription() }

function checkItemsDivDisplay(itemsDiv, cell)
{
	var isVisible = (cell.field.capacity == "_unique value");
	var dt = cr.dataTypes[cell.field.dataType];
	// Loop over cell.data instead of itemsDiv cells in case this test is done before
	// the deleted cell is deleted or the added cell is added. 
	for (var i = 0; i < cell.data.length; i++)
		isVisible |= !dt.isEmpty(cell.data[i]);
	itemsDiv.style("display", isVisible ? "block" : "none");
}

function setupItemsDivHandlers(itemsDiv, cell)
{
	cell.addTarget("valueAdded.cr", itemsDiv.node());
	cell.addTarget("valueDeleted.cr", itemsDiv.node());
	cell.addTarget("dataChanged.cr", itemsDiv.node());
	$(itemsDiv.node()).on("dataChanged.cr valueDeleted.cr valueAdded.cr", function(e)
		{
			checkItemsDivDisplay(itemsDiv, cell);
		});
}

function setupItemHandlers(d)
{
	if (d.cell.field.capacity != "_unique value")
	{
		$(this).on("valueDeleted.cr", function(e, newData)
		{
			$(this).animate({height: "0px"}, 200, 'swing', function() { $(this).remove(); });
		});
		d.addTarget("valueDeleted.cr", this);
	}
}

function showViewStringCell(obj, cell)
{
	var sectionObj = d3.select(obj);
	
	sectionObj.classed("cell-div", true)
		.classed("border-below", cell.field.capacity == "_unique value");
	
	var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		labelDiv.classed("left-label-div left-fixed-width-div", true);
		itemsDiv.classed("right-label-div expanding-div", true);
	}
	else
		itemsDiv.classed("border-above border-below", true);

	var setupItems = function(divs, cell) {
		divs.classed("list-div", cell.field.capacity != "_unique value")
		.append("div")
		.classed("string-value-view", true)
		.classed("string-multi-value-container", cell.field.capacity != "_unique value")
		.text(getDataValue)
		.each(pushTextChanged);
	}
	
	setupItemsDivHandlers(itemsDiv, cell);
	$(itemsDiv.node()).on("valueAdded.cr", function(e, newData)
		{
			setupItems(
				d3.select(this).append("li"), cell);
		});
	
	var divs = _appendItems(itemsDiv, cell.data);
	setupItems(divs, cell);
}

function showEditStringCell(obj, panelDiv, cell, containerUUID, inputType)
{
	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true)
		.classed("border-below", cell.field.capacity == "_unique value");
	
	if (cell.field.capacity == "_unique value")
	{
		var itemsDiv = sectionObj.append("div").classed("items-div string-unique-item", true);

		var divs = itemsDiv.selectAll("li")
			.data(cell.data)
			.enter()
			.append("li")
			.classed("string-input-container", true);	// So that each item appears on its own row.
	
		divs.append("input")
			.classed("string-unique-input", true)
			.attr("type", inputType)
			.attr("placeholder", cell.field.name)
			.property("value", getDataValue);

		if (cell.field.descriptorType != "_by text")
		{
			var labelDiv = sectionObj.insert("div", ":first-child").classed("cell-label-div string-unique-input-label", true)
				.text(cell.field.name);
			labelDiv
				.style("line-height", divs.selectAll("input").style("line-height"));
			
			divs.selectAll("input").classed("string-unique-labeled-input", "true")
		}
	}
	else
	{
		sectionObj.append("div").classed("cell-label-div", true)
			      .text(cell.field.name);
		var itemsDiv = sectionObj.append("div")
			.classed("items-div border-above", true);

		var divs = _appendItems(itemsDiv, cell.data);
		
		var appendControls = function(divs, cell)
		{	
			appendConfirmDeleteControls(divs, cell);
			
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
				.property("value", getDataValue);
		}
		
		appendControls(divs, cell);

		setupItemsDivHandlers(itemsDiv, cell);
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
 */
function getOnValueAddedFunction(panelDiv, cell, containerUUID, canDelete, canShowDetails, viewFunction)
{
	return function(e, newData)
	{
		var itemsDiv = d3.select(this);
	
		var divs = itemsDiv
			.append("li")	// So that each button appears on its own row.
			.datum(newData)
			.each(setupItemHandlers);
		
		checkItemsDivDisplay(itemsDiv, cell);
		
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
			appendConfirmDeleteControls(divs, cell);
		
		var buttons = appendRowButtons(divs, cell);

		buttons.on("click", function(d) {
			if (prepareClick())
			{
				var cell = itemsDiv.datum();
				viewFunction(d, cell, containerUUID, panelDiv);
			}
		});
		if (canDelete && cell.field.capacity != "_unique value")
			appendDeleteControls(buttons);
		if (canShowDetails)
			appendRightChevrons(buttons);

		appendButtonDescriptions(buttons, cell);
	}
}

function appendRowButtons(divs, cell)
{
	return divs.append("div")
			.classed("btn row-button multi-row-content expanding-div", cell.field.capacity != "_unique value");
}

function appendConfirmDeleteControls(divs, containerCell)
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
	
	divs.append("button")
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
		})
		.on('click', function(d)
		{
			if (prepareClick())
			{
				var deleteDiv = $(this).parents()[0];
				var failFunction = syncFailFunction;
				var successFunction = function()
				{
					unblockClick();
				}
				cr.deleteValue(d, containerCell, successFunction, failFunction);
			}
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
		.classed("glyphicon glyphicon-chevron-right text-muted right-fixed-width-div right-vertical-chevron", true);
}

/* This function appends the descriptions of each object to the button. */
function appendButtonDescriptions(buttons, cell)
{
	buttons.append("span")
		.classed("text-muted", true)
		.classed("string-value-view expanding-div", true)
		.classed("string-multi-value-container pull-left", cell.field.capacity != "_unique value")
		.text(getDataDescription)
		.each(pushTextChanged);
}

function showViewObjectCell(obj, containerPanel, cell, containerUUID)
{
	var sectionObj = d3.select(obj).classed("cell-div", true)
		.classed("btn row-button unique-row-button", cell.field.capacity == "_unique value" && !isPickCell(cell))
		.classed("border-below", cell.field.capacity == "_unique value");
	
	var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		labelDiv.classed("left-label-div left-fixed-width-div", true);
		itemsDiv.classed("right-label-div expanding-div", true);
		if (!isPickCell(cell))
			sectionObj.on("click", function(cell) {
				if (prepareClick())
				{
					showViewObjectPanel(cell.data[0], cell, containerUUID, containerPanel);
				}
			});
	}
	else
		itemsDiv.classed("border-above border-below", true);

	setupItemsDivHandlers(itemsDiv, cell);
	$(itemsDiv.node()).on("valueAdded.cr", getOnValueAddedFunction(containerPanel, cell, containerUUID, false, !isPickCell(cell), showViewObjectPanel));
	
	var clickFunction;
	if (isPickCell(cell) || cell.field.capacity == "_unique value")	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
			if (prepareClick())
			{
				showViewObjectPanel(d, cell, containerUUID, containerPanel);
			}
		}

	var divs = _appendItems(itemsDiv, cell.data);
	
	var buttons;
	if (!isPickCell(cell)) {
		buttons = appendRowButtons(divs, cell);
	
		if (clickFunction)
			buttons.on("click", clickFunction);
		
		appendRightChevrons(buttons);
	}
	else
	{
		buttons = divs.append("div").classed("list-div", cell.field.capacity != "_unique value");
	}
	
	appendButtonDescriptions(buttons, cell);
}

function showEditObjectCell(obj, panelDiv, cell, parent, storeDataFunction)
{
	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true)
		.classed("btn row-button unique-row-button border-below", cell.field.capacity == "_unique value");
	
	var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		labelDiv.classed("left-label-div left-fixed-width-div", true);
		itemsDiv.classed("right-label-div expanding-div", true);
		sectionObj.on("click", function(cell) {
			if (prepareClick())
			{
				if (isPickCell(cell))
					showPickObjectPanel(cell.data[0], cell, parent.getValueID(), panelDiv);
				else
					showEditObjectPanel(cell.data[0], cell, parent.getValueID(), panelDiv);
			}
		});
	}
	else
		itemsDiv.classed("border-above", true);

	setupItemsDivHandlers(itemsDiv, cell);
	$(itemsDiv.node()).on("valueAdded.cr", getOnValueAddedFunction(panelDiv, cell, parent.getValueID(), true, true, showEditObjectPanel));

	var clickFunction;
	if (cell.field.capacity == "_unique value")	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
				if (prepareClick())
				{
					if (isPickCell(cell))
						showPickObjectPanel(d, cell, parent.getValueID(), panelDiv);
					else
						showEditObjectPanel(d, cell, parent.getValueID(), panelDiv);
				}
			};
		
	var divs = _appendItems(itemsDiv, cell.data);
	
	if (cell.field.capacity != "_unique value")
		appendConfirmDeleteControls(divs, cell);
		
	var buttons = appendRowButtons(divs, cell);

	if (clickFunction)
		buttons.on("click", clickFunction);
	
	if (cell.field.capacity != "_unique value")
		appendDeleteControls(buttons);

	appendRightChevrons(buttons);	
		
	appendButtonDescriptions(buttons, cell);
	
	if (["_over time", "_multiple values"].indexOf(cell.field["capacity"]) >= 0)
	{
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(cell) {
				if (prepareClick())
				{
					var newValue = cell.addNewValue();
					
					if (isPickCell(cell))
						showPickObjectPanel(newValue, cell, parent.getValueID(), panelDiv)
					else
						showAddObjectPanel(newValue, parent.getValueID(), panelDiv, storeDataFunction);
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
				if (this.value != d.value)
				{
					initialData.push({id: d.id, value: this.value});
					sourceObjects.push(d);
				}
			}
			else
			{
				if (this.value != d.value)
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

function _appendUpdateObjectCommands(sectionObj, cell, objectData, initialData, sourceObjects)
{
	d3.select(sectionObj).selectAll(".items-div>div").each(function(d, i)
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
					cr.dataTypes[this.field.dataType].appendData(this, newDatum.value.cells);
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
function submitCreateInstance(oldValue, containerCell, containerUUID, sections, onSuccessFunction)
{
	var initialData = []
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
			showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "text");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "text");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell,
	},
	_number: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "number");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "number");
		},
		appendUpdateCommands: _appendUpdateStringCommands,
		updateCell: _updateStringCell
	},
	_datestamp: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			showViewStringCell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "date");
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			showEditStringCell(obj, containerPanel, cell, parent.getValueID(), "date");
		},
		appendUpdateCommands: _appendUpdateDatestampCommands,
		updateCell: _updateDatestampCell,
	},
	_object: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			showViewObjectCell(obj, containerPanel, cell, containerUUID);
		},
		showEdit: function(obj, containerPanel, cell, parent)
		{
			/* If containerUUID is null during an edit operation, then the container
				is new and was not saved. */
			if (parent.getValueID())
				showEditObjectCell(obj, containerPanel, cell, parent, submitCreateInstance);
			else
				showEditObjectCell(obj, containerPanel, cell, parent, _storeNewInstance);
		},
		showAdd: function(obj, containerPanel, cell, parent)
		{
			/* If containerUUID is null, then the object being added is either within a new root object
				or an object contained within an item that wasn't saved. In either case, 
				store any item added to this cell as part of the data of the cell.
			 */
			showEditObjectCell(obj, containerPanel, cell, parent, _storeNewInstance);
		},
		appendUpdateCommands: _appendUpdateObjectCommands,
		updateCell: _updateObjectCell
	},
};

/* Append a set of buttons to each div for displaying the text for each item. */
function appendViewButtons(divs)
{
	var buttons = divs.append("div").classed("btn row-button multi-row-content expanding-div", true);
	
	buttons.append("span")
		.classed("text-muted pull-left", true)
		.text(getDataDescription)
		.each(pushTextChanged);
		
	return buttons;
}

function _appendItems(container, data)
{
	// Remove any lingering contents from the set of full issues.
	container.selectAll("li").remove();

	return container.selectAll("li")
		.data(data)
		.enter()
		.append("li")	// So that each button appears on its own row.
		.each(setupItemHandlers);
}

/* Returns the set of objects that contain the description of each data element */
function appendCellItems(container, cell, clickFunction)
{
	var divs = _appendItems(container, cell.data);
	
	if (cell.field.capacity != "_unique value")
		appendConfirmDeleteControls(divs, cell);
	
	var buttons = appendRowButtons(divs, cell);
	
	buttons.append("span")
		.classed("text-muted pull-left", true)
		.text(getDataDescription)
		.each(pushTextChanged);
		
	buttons.on("click", clickFunction);
	appendRightChevrons(buttons);
	
	return buttons;
}

/* From the specified configuration array of objects, get the objects in index order. 
	Indexes are retrieved using the getIndex function.*/
/* Creates a panel that sits atop the specified containerPanel in the same container. */
function createPanel(containerPanel, datum, headerText)
{
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
			return this.append("div").classed("site-navbar-commands", true)
					   .append("div").classed("site-title site-fill", true)
					   .append("span").classed("site-inner-fill", true)
					   .text(newTitle);
		}
	
		return navContainer;
	}
	
	panelDiv.appendSearchBar = function(textChangedFunction)
	{
		var searchBarDiv = this.append("div").classed("searchbar always-visible", true);
		setupSearchBar(searchBarDiv.node(), textChangedFunction)
	}
	
	panelDiv.appendScrollArea = function()
	{
		var panel2Div = this.append("div").classed("panel-scrolling", true);
		
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
			return panel2Div.selectAll("section")
					.data(sectionData)
					.enter()
					.append("section")
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
					});
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
		
	$(searchInput.node()).on("keyup input paste", function(e) {
		searchCancelButton
			.classed("site-disabled-text", this.value.length == 0)
			.classed("site-active-text", this.value.length > 0);
		textChanged.call(this);
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

/* Displays a panel in which the specified object's contents appear.
 */
function showViewObjectPanel(objectData, containerCell, containerUUID, containerPanel) {
	successFunction = function ()
	{
			
		var panelDiv = createPanel(containerPanel, 
									objectData, getViewPanelHeader(objectData, containerCell))
			.classed("show-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").classed("glyphicon glyphicon-chevron-left site-active-text", true);
		backButton.append("span").text(" " + containerPanel.attr("headerText"));
	
		var editButton = navContainer.appendRightButton()
			.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
				
					showEditObjectPanel(objectData, containerCell, containerUUID, panelDiv);
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
							
		window.scrollTo(0, 0);
		showPanelLeft(panelDiv.node());
	
		panel2Div.show_view_cells(objectData, containerCell, containerUUID, panelDiv);
	}
	
	failFunction = function(error)
	{
		alert(error);
		unblockClick();
	}
	
	objectData.checkCells(containerCell, successFunction, failFunction)
}

/* 
	Displays a panel for editing the specified object. 
 */
function showEditObjectPanel(objectData, containerCell, containerUUID, containerPanel) {
	var successFunction = function()
	{
		var panelDiv = createPanel(containerPanel, 
									objectData, "Edit")
						.classed("edit-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var doneButton = navContainer.appendRightButton();
		doneButton.append("span").text("Done");

		var panel2Div = panelDiv.appendScrollArea();
		panel2Div.appendAlertContainer();
		window.scrollTo(0, 0);
		showPanelUp(panelDiv.node());

		panel2Div.show_edit_cells(objectData, containerCell, panelDiv);

		doneButton.on("click", function(d) {
			if (prepareClick())
			{
				showClickFeedback(this);
			
				var sections = panel2Div.selectAll("section");
				var successFunction = function()
				{
					hidePanelDown($(doneButton.node()).parents(".site-panel")[0]);
				};
				if (objectData.getValueID())
				{
					/* This object has been previously saved. Update the data. */
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
						cr.updateValues(initialData, sourceObjects, updateValuesFunction, successFunction, syncFailFunction);
					}
					else
					{
						successFunction();
					}
				}
				else if (containerCell.parent != null && containerCell.parent.getValueID())
				{
					submitCreateInstance(objectData, containerCell, containerCell.parent.getValueID(), sections, successFunction);
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
					successFunction();
				}
			}
			d3.event.preventDefault();
		});
	}
	
	failFunction = function(error)
	{
		alert(error);
		unblockClick();
	}
	
	objectData.checkCells(containerCell, successFunction, failFunction);
}

function _storeUnsavedPickedValue(cell, oldData, newData)
{
	if (oldData)
	{
		/* In this case, we are replacing an old value for
		   an item that was added to the item but not saved;
		   a placeholder or a previously picked value.
		 */
		if (newData.getValueID() != oldData.getValueID()) {
			oldData.completeUpdateValue(newData);
		}
	}
	else	/* In this case, we are adding an object to a new object. */
	{
		cell.addValue(newData);
	}
}

/* Displays a panel from which a user can select an object of the kind required 
	for objects in the specified cell.
	containerUUID is the id of the instance that contains the specified cell.
 */
function showPickObjectPanel(oldData, cell, containerUUID, containerPanel) {
	if (!oldData)
		throw "oldData is not defined";
		
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
				if (!_isClickBlocked())
				{
					_blockClick();
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
		
		var itemsDiv = panel2Div.append("div")
			.classed("border-above", true);
		
		var sections = itemsDiv.selectAll("li")
					.data(rootObjects)
					.enter()
					.append("li")
					.classed("border-below", true);
	
		var buttons = appendViewButtons(sections)
			.on("click", function(d) {
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
						_storeUnsavedPickedValue(cell, oldData, d);
						successFunction();
					}
				}
				d3.event.preventDefault();
			});
		buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
			function(d) { return d.getDescription() == oldData.getDescription(); });
	
		window.scrollTo(0, 0);
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
				cr.selectAll(pickObjectPath, selectAllSuccessFunction, failFunction);
			}
			else
				failFunction("The container has not yet been saved.");
		}
		else	
			cr.selectAll(pickObjectPath, selectAllSuccessFunction, failFunction);
	}
	else
		cr.selectAll(cell.field.ofKindID, selectAllSuccessFunction, failFunction);
}
		
/* This method gets called to bring up a configuration panel when adding
	a new instance of an object to another object. For example, adding a 
	configuration to an object with a uuname kind.
 */
function showAddObjectPanel(oldValue, containerUUID, containerPanel, storeDataFunction) {
	if (!oldValue)
		throw "oldValue is not defined";
	if (!oldValue.cell)
		throw "oldValue.cell is not defined";
		
	var successFunction = function(cells)
	{
		var panelDiv = createPanel(containerPanel, oldValue.cell, "New " + oldValue.cell.field.name)
			.classed("edit-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (!_isClickBlocked())
				{
					_blockClick();
					if (!oldValue.getValueID() && oldValue.cell.field.maxCapacity != "_unique value")
					{
						// In this case, delete the item on cancel. 
						oldValue.cell.deleteValue(oldValue);
					}
					hidePanelDown($(this).parents(".site-panel")[0]);
				}
				d3.event.preventDefault();
			});
		
		backButton.append("span").text("Cancel");

		var onSuccessFunction = function(newData) {
			hidePanelDown(panelDiv.node());
		};
			
		var addButton = navContainer.appendRightButton()
			.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
					
					storeDataFunction(oldValue, oldValue.cell, containerUUID, sections, onSuccessFunction);
				}
				d3.event.preventDefault();
			});
		addButton.append("span").text("Add");

		var panel2Div = panelDiv.appendScrollArea();
		panel2Div.appendHeader();
		panel2Div.appendAlertContainer();
		
		var sections = panel2Div.appendSections(cells)
			.each(function(cell) {
					dataTypeViews[cell.field.dataType].showAdd(this, panelDiv, cell, oldValue);
				});

		window.scrollTo(0, 0);
		showPanelUp(panelDiv.node());
	}
	
	var failFunction = syncFailFunction
	
	cr.getConfiguration(oldValue, oldValue.cell.field.ofKindID, successFunction, failFunction);
}

