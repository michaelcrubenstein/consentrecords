var clickBlockCount = 0;

/* Determines whether clicks should be blocked on the page.
	This is used to prevent extra clicks on buttons from repeating operations.
 */
function is_click_blocked()
{
	return clickBlockCount;
}

/* Blocks clicks on the page. */			
function block_click()
{
	if (clickBlockCount > 0)
		throw ("Click over blocked");
	clickBlockCount += 1;
}

/* Unblocks clicks on the page. */			
function unblock_click()
{
	if (clickBlockCount == 0)
		throw ("Click unblocked.");
	clickBlockCount -= 1;
}

function show_click_feedback(obj)
{
	$(obj).animate({opacity: "0.2"}, 200)
		   .animate({opacity: "1.0"}, 200);
}

function show_panel_up(panelNode)
{
	$(panelNode).offset({top: window.innerHeight, left: 0})
				   .height(0)
				   .width("100%")
				   .css("display", "block")
				   .trigger("revealing")
				   .animate({height: "100%", top: 0}, 400, "swing",
						function() {
							$(window).trigger("resize");
							inputObject = d3.select(this).selectAll("input").node();
							if (inputObject)
								inputObject.focus();
							unblock_click();
						});
}

function show_panel_left(panelNode)
{
	$(panelNode).offset({top: 0, left: window.innerWidth})
				   .height("100%")
				   .width("100%")
				   .css("display", "block")
				   .trigger("revealing")
				   .animate({width: "100%", left: 0}, 400, "swing",
						function() {
							$(window).trigger("resize");
							inputObject = d3.select(this).selectAll("input").node();
							if (inputObject)
								inputObject.focus();
							unblock_click();
						});
}

function hide_panel_down(panelNode, doRemove)
{
	doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
	$(panelNode).animate({top: window.innerHeight}, 400, "swing", 
		function() {
			if (doRemove)
				$(this).remove();
			unblock_click();
		});
}

function hide_panel_right(panelNode, doRemove)
{
	doRemove = typeof doRemove !== 'undefined' ? doRemove : true;
	
	$(panelNode).animate({left: window.innerWidth}, 400, "swing", 
		function() {
			if (doRemove)
				$(this).remove();
			unblock_click();
		});
}
		
function handle_close_right_event() {
	if (!is_click_blocked())
	{
		block_click();
		hide_panel_right($(this).parents(".site-panel")[0]);
	}
	d3.event.preventDefault();
}

function handle_close_down_event() {
	if (!is_click_blocked())
	{
		block_click();
		hide_panel_down($(this).parents(".site-panel")[0]);
	}
	d3.event.preventDefault();
}

function prepare_click()
{
	if (is_click_blocked())
		return false;
	closealert();
	block_click();
	return true;
}
 
function is_pick_cell(cell)
{
	if (("_object add rule" in cell.field) &&
			 (cell.field["_object add rule"] == "_pick one" ||
			  cell.field["_object add rule"] == "_pick or create one"))
		return true;
	else
		return false;
}

function push_text_changed(d) {
	d.add_target("dataChanged", this);
	$(this).on("dataChanged", function(e) {
			d3.select(this).text(d.getDescription());
		});
}

getDataValue = function(d) { return d.value; }
getDataDescription = function(d) { return d.getDescription() }

function show_view_string_cell(obj, cell)
{
	var sectionObj = d3.select(obj);
	
	sectionObj.classed("cell-div", true);
	
	var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		labelDiv.classed("left-label-div left-fixed-width-div", true);
		itemsDiv.classed("right-label-div expanding-div", true);
	}

	var setupItems = function(divs, cell) {
		divs.classed("list-div", cell.field.capacity != "_unique value")
		.append("div")
		.classed("string-value-view", true)
		.classed("string-multi-value-container", cell.field.capacity != "_unique value")
		.text(getDataValue)
		.each(push_text_changed);
	}
	
	cell.add_target("valueAdded", itemsDiv.node());
	$(itemsDiv.node()).on("valueAdded", function(e, newData)
		{
			setupItems(d3.select(this).append("div"), cell);
		});
	
		
	var divs = itemsDiv.selectAll("div")
		.data(cell.data)
		.enter()
		.append("div");
	setupItems(divs, cell);
}

function show_edit_string_cell(obj, panelDiv, cell, containerUUID, inputType)
{
	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true);
	
	if (cell.field.capacity == "_unique value")
	{
		var itemsDiv = sectionObj.append("div").classed("items-div string-unique-item", true);

		var divs = itemsDiv.selectAll("div")
			.data(cell.data)
			.enter()
			.append("div")
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
		var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
			.text(cell.field.name);
		sectionObj.append("hr");
		var itemsDiv = sectionObj.append("div").classed("items-div", true);

		var divs = itemsDiv.selectAll("div")
			.data(cell.data)
			.enter()
			.append("div")
			.classed("string-input-container", true)	// So that each item appears on its own row.
			.classed("string-multi-value-container", true);
	
		divs.append("input")
			.classed("string-input", true)
			.attr("type", inputType)
			.attr("placeholder", cell.field.name)
			.property("value", getDataValue);

		if (cell.field.capacity == "_unique value")
		{
			labelDiv
				.style("line-height", divs.selectAll("input").style("line-height"));
			itemsDiv.style("width", sectionObj.style("width") - labelDiv.style("width"));
			$(window).resize(function()
			{
				$(itemsDiv.node()).width($(sectionObj.node()).width() 
					- $(labelDiv.node()).width()
					- labelDiv.style("padding-left")
					- labelDiv.style("padding-right"));
			});
		}

		if (["_over time", "_multiple values"].indexOf(cell.field.capacity) >= 0)
		{
			cell.add_target("valueAdded", itemsDiv.node());
			$(itemsDiv.node()).on("valueAdded", function(e, newData)
				{
					d3.select(this).append("div").classed("string-input-container", true)
						.classed("string-multi-value-container", true)
						.datum(newData)
						.append("input").classed("string-input", true)
						.attr("type", inputType)
						.attr("placeholder", cell.field.name)
						.text(newData.value);
				});
		
			/* Add one more button for the add Button item. */
			var buttonDiv = sectionObj.append("div")
				.append("button").classed("btn row-button site-active-text add-element-button", true)
				.on("click", function(cell) {
					if (prepare_click())
					{
						show_click_feedback(this);
					
						var newData = cr.dataTypes[cell.field.dataType].newValue();
						cell.data.push(newData);
						newData.add_target("dataChanged", cell);
						cell.trigger_event("valueAdded", [newData]);
					
						unblock_click();
					}
					d3.event.preventDefault();
				})
				.append("div").classed("pull-left", true);
			buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
			buttonDiv.append("span").text(" add " + cell.field.name);
			sectionObj.append("hr");
		}
	}
}

function show_add_string_cell(obj, panelDiv, cell, containerUUID, inputType)
{
	/* With this field unique, there will be a data element in the cell
	 */

	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true);
	
	if (cell.field.capacity == "_unique value")
	{
		var itemsDiv = sectionObj.append("div").classed("items-div string-unique-item", true);

		var divs = itemsDiv.selectAll("div")
			.data(cell.data)
			.enter()
			.append("div")
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
		if (cell.field.capacity != "_unique value")
		{
			sectionObj.append("div").classed("cell-label-div", true)
					  .text(cell.field.name);
			sectionObj.append("hr");
		}
	
		var itemsDiv = sectionObj.append("div").classed("items-div", true);

		var divs = itemsDiv.selectAll("div")
			.data(cell.data)
			.enter()
			.append("div")
			.classed("string-input-container string-multi-value-container", true);	// So that each item appears on its own row.
	
		divs.append("input").classed("string-input", true)
			.attr("type", inputType)
			.attr("placeholder", cell.field.name);

		if (["_over time", "_multiple values"].indexOf(cell.field["capacity"]) >= 0)
		{
			cell.add_target("valueAdded", itemsDiv.node());
			$(itemsDiv.node()).on("valueAdded", function(e, newData)
				{
					d3.select(this).append("div").classed("string-input-container string-multi-value-container", true)
						.datum(newData)
						.append("input").classed("string-input", true)
						.attr("type", inputType)
						.attr("placeholder", cell.field.name)
						.text(newData.value);
				});
		
			/* Add one more button for the add Button item. */
			var buttonDiv = sectionObj.append("div")
				.append("button").classed("btn row-button site-active-text add-element-button", true)
				.on("click", function(cell) {
					if (prepare_click())
					{
						show_click_feedback(this);
					
						var newData = cr.dataTypes[cell.field.dataType].newValue();
						cell.data.push(newData);
						newData.add_target("dataChanged", cell);
						cell.trigger_event("valueAdded", [newData]);
					
						unblock_click();
					}
					d3.event.preventDefault();
				})
				.append("div").classed("pull-left", true);
			buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
			buttonDiv.append("span").text(" add " + cell.field.name);
			sectionObj.append("hr");
		}
	}
}

/* Produces a function which adds new value view to a container view
	when the new data is added.
 */
function get_on_value_added_function(panelDiv, cell, containerUUID, viewFunction)
{
	return function(e, newData)
	{
		var itemsDiv = d3.select(this);
	
		var divs = itemsDiv
			.append("div")	// So that each button appears on its own row.
			.datum(newData);
		var buttons = divs.append("button")
			.classed("btn row-button", true);
		if (viewFunction)
		{
			buttons.on("click", function(d) {
				if (prepare_click())
				{
					var cell = itemsDiv.datum();
					viewFunction(d, cell, containerUUID, panelDiv);
				}
			});
			buttons.append("span")
				.classed("glyphicon glyphicon-chevron-right text-muted pull-right", true);
		}

		appendButtonDescriptions(buttons, cell);
	}
}

/* This function appends the descriptions of each object to the button. */
function appendButtonDescriptions(buttons, cell)
{
	buttons.append("span")
		.classed("text-muted", true)
		.classed("string-value-view expanding-div", true)
		.classed("string-multi-value-container pull-left", cell.field.capacity != "_unique value")
		.text(getDataDescription)
		.each(push_text_changed);
}

function show_view_object_cell(obj, containerPanel, cell, containerUUID)
{
	var sectionObj = d3.select(obj).classed("cell-div", true)
		.classed("button row-button", cell.field.capacity == "_unique value" && !is_pick_cell(cell));
	
	var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		labelDiv.classed("left-label-div left-fixed-width-div", true);
		itemsDiv.classed("right-label-div expanding-div", true);
		if (!is_pick_cell(cell))
			sectionObj.on("click", function(cell) {
				if (prepare_click())
				{
					show_view_object_panel(cell.data[0], cell, containerUUID, containerPanel);
				}
			});
	}

	cell.add_target("valueAdded", itemsDiv.node());
	$(itemsDiv.node()).on("valueAdded", get_on_value_added_function(containerPanel, cell, containerUUID, show_view_object_panel));
	
	var clickFunction;
	if (is_pick_cell(cell) || cell.field.capacity == "_unique value")	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
			if (prepare_click())
			{
				show_view_object_panel(d, cell, containerUUID, containerPanel);
			}
		}

	var divs = refresh_divs(itemsDiv, cell.data);
	
	var buttons;
	if (!is_pick_cell(cell)) {
		buttons = divs.append("div")
			.classed("btn row-button", cell.field.capacity != "_unique value");
	
		if (clickFunction)
			buttons.on("click", clickFunction);
		
		buttons.append("span")
			.classed("glyphicon glyphicon-chevron-right text-muted pull-right", true);
	}
	else
	{
		buttons = divs.append("div").classed("list-div", cell.field.capacity != "_unique value");
	}
	
	appendButtonDescriptions(buttons, cell);
}

function show_edit_object_cell(obj, panelDiv, cell, containerUUID, storeDataFunction)
{
	var sectionObj = d3.select(obj).classed("cell-div cell-edit-div", true)
		.classed("button row-button", cell.field.capacity == "_unique value");
	
	var labelDiv = sectionObj.append("div").classed("cell-label-div", true)
		.text(cell.field.name);
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	if (cell.field.capacity == "_unique value")
	{
		labelDiv.classed("left-label-div left-fixed-width-div", true);
		itemsDiv.classed("right-label-div expanding-div", true);
		sectionObj.on("click", function(cell) {
			if (prepare_click())
			{
				if (is_pick_cell(cell))
					show_pick_object_panel(cell.data[0], cell, containerUUID, panelDiv);
				else
					show_edit_object_panel(cell.data[0], cell, containerUUID, panelDiv);
			}
		});
	}
	else
		sectionObj.insert("hr", ".items-div");

	cell.add_target("valueAdded", itemsDiv.node());
	$(itemsDiv.node()).on("valueAdded", get_on_value_added_function(panelDiv, cell, containerUUID, show_edit_object_panel));

	var clickFunction;
	if (cell.field.capacity == "_unique value")	/* Unique value handles the click above */
		clickFunction = null;
	else
		clickFunction = function(d) {
				if (prepare_click())
				{
					if (is_pick_cell(cell))
						show_pick_object_panel(d, cell, containerUUID, panelDiv);
					else
						show_edit_object_panel(d, cell, containerUUID, panelDiv);
				}
			};
		
	var divs = refresh_divs(itemsDiv, cell.data);
	
	var buttons;
	buttons = divs.append("div")
		.classed("btn row-button", cell.field.capacity != "_unique value");

	if (clickFunction)
		buttons.on("click", clickFunction);
	
	buttons.append("span")
		.classed("glyphicon glyphicon-chevron-right text-muted pull-right", true);
	
	appendButtonDescriptions(buttons, cell);
	
	if (["_over time", "_multiple values"].indexOf(cell.field["capacity"]) >= 0)
	{
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div")
			.append("button").classed("btn row-button site-active-text add-element-button", true)
			.on("click", function(cell) {
				if (prepare_click())
				{
					if (is_pick_cell(cell))
						show_pick_object_panel(null, cell, containerUUID, panelDiv)
					else
						show_add_object_panel(null, cell, containerUUID, panelDiv, storeDataFunction);
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add " + cell.field.name);
		sectionObj.append("hr");
	}
}

function append_update_string_commands(sectionObj, cell, objectData, initialData, sourceObjects)
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

function append_update_datestamp_commands(sectionObj, cell, objectData, initialData, sourceObjects)
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

function append_update_object_commands(sectionObj, cell, objectData, initialData, sourceObjects)
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

function update_string_cell(sectionObj, cell)
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

function update_datestamp_cell(sectionObj, cell)
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

function update_object_cell(sectionObj, cell)
{
	/* Do nothing at the moment. */
}

var dataTypeViews = {
	_string: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			show_view_string_cell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, containerUUID)
		{
			show_edit_string_cell(obj, containerPanel, cell, containerUUID, "text");
		},
		showAdd: function(obj, containerPanel, cell, containerUUID)
		{
			show_add_string_cell(obj, containerPanel, cell, containerUUID, "text");
		},
		appendUpdateCommands: append_update_string_commands,
		updateCell: update_string_cell,
	},
	_number: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			show_view_string_cell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, containerUUID)
		{
			show_edit_string_cell(obj, containerPanel, cell, containerUUID, "number");
		},
		showAdd: function(obj, containerPanel, cell, containerUUID)
		{
			show_add_string_cell(obj, containerPanel, cell, containerUUID, "number");
		},
		appendUpdateCommands: append_update_string_commands,
		updateCell: update_string_cell
	},
	_datestamp: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			show_view_string_cell(obj, cell);
		},
		showEdit: function(obj, containerPanel, cell, containerUUID)
		{
			show_edit_string_cell(obj, containerPanel, cell, containerUUID, "date");
		},
		showAdd: function(obj, containerPanel, cell, containerUUID)
		{
			show_add_string_cell(obj, containerPanel, cell, containerUUID, "date");
		},
		appendUpdateCommands: append_update_datestamp_commands,
		updateCell: update_datestamp_cell,
	},
	_object: {
		show: function(obj, containerPanel, cell, containerUUID)
		{
			show_view_object_cell(obj, containerPanel, cell, containerUUID);
		},
		showEdit: function(obj, containerPanel, cell, containerUUID)
		{
			show_edit_object_cell(obj, containerPanel, cell, containerUUID, submit_create_instance);
		},
		showAdd: function(obj, containerPanel, cell, containerUUID)
		{
			show_edit_object_cell(obj, containerPanel, cell, containerUUID, store_new_instance);
		},
		appendUpdateCommands: append_update_object_commands,
		updateCell: update_object_cell
	},
};

function appendButtons(divs)
{
	var buttons = divs.append("button").classed("btn row-button", true);
	
	buttons.append("span")
		.classed("text-muted pull-left", true)
		.text(getDataDescription)
		.each(push_text_changed);
		
	return buttons;
}

function appendDivs(divs)
{
	var buttons = divs.append("div").classed("list-div", true);
	
	buttons.append("span")
		.classed("text-muted pull-left", true)
		.text(getDataDescription)
		.each(push_text_changed);
		
	return buttons;
}

function refresh_divs(container, data)
{
	// Remove any lingering contents from the set of full issues.
	container.selectAll("div").remove();

	return container.selectAll("div")
		.data(data)
		.enter()
		.append("div");	// So that each button appears on its own row.
}

/* Returns the set of objects that contain the description of each data element */
function layout_objects(container, data, clickFunction)
{
	var divs = refresh_divs(container, data);
	
	var buttons;
	if (clickFunction) {
		buttons = appendButtons(divs);
		buttons.on("click", clickFunction);
		buttons.append("span")
			.classed("glyphicon glyphicon-chevron-right text-muted pull-right", true);
	}
	else
	{
		buttons = appendDivs(divs);
	}
	
	return buttons;
}

/* From the specified configuration array of objects, get the objects in index order. 
	Indexes are retrieved using the getIndex function.*/
/* Creates a panel that sits atop the specified containerPanel in the same container. */
function create_panel(containerPanel, datum, headerText)
{
	var rootPanel = d3.select($(containerPanel.node()).parents()[0]);
	var zindex = parseInt(containerPanel.style("z-index"))+1;
	var panelDiv = rootPanel
					.append("div")
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
	
		return navContainer;
	}
	
	panelDiv.appendScrollArea = function()
	{
		var panel2Div = panelDiv.append("div").classed("panel-scrolling", true);
		
		panel2Div.appendHeader = function()
		{
			return this.append("header").classed("configuration-header", true)
				.text(headerText);
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
							cell.add_target("valueAdded", this);
							$(this).on("valueAdded", function(e, newData) {
								$(this).css("display", "block");
							});
							$(this).on("dataChanged", function(e) {
								$(this).css("display", "block");
							});
							d3.select(this).append("hr");
						}
					});
		}
		
		panel2Div.show_edit_cells = function(objectData, cell, panelDiv)
		{
			this.appendSections(objectData.value.cells)
				.each(function(cell) {
						dataTypeViews[cell.field.dataType].showEdit(this, panelDiv, cell, objectData.getValueID());
					});
		}
		
		$(window).resize(panel2Div.resetHeight);
		
		return panel2Div;
	}

	return panelDiv;
}

