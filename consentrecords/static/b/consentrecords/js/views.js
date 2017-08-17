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
			if (bootstrap_alert.closeOnTimeout && clickBlockCount == 0)
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
			.html(function(d) { return d; });
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
		panel.selectAll('span').remove();
		panel.selectAll('span')
			.data(message.toString().split('\n'))
			.enter()
			.append('span')
			.html(function(d) { return d; });
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
	defaultLanguageCode: 'en',
	languages: [{code: 'en', name: "English"}, 
			    {code: 'sp', name: "Spanish"},
			    {code: 'zh', name: "Chinese"}],
			    
	buttonTexts: {
		done: "Done",
		edit: "Edit",
		cancel: "Cancel",
		add: "Add",
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

	appendAddButton: function(sectionObj, name, done)
	{
		/* Add one more button for the add Button item. */
		var buttonDiv = sectionObj.append("div")
			.classed('add-value site-active-text', true)
			.on("click", function(cell) {
				if (prepareClick('click', "add {0}".format(name)))
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
			});
		buttonDiv.append('div')
			.classed('overlined', !sectionObj.classed('first'))
			.text("Add {0}".format(name));
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

function _isPickCell(cell)
{
	if (("objectAddRule" in cell.field) &&
			 (cell.field["objectAddRule"] == cr.objectAddRules.pickOne ||
			  cell.field["objectAddRule"] == cr.objectAddRules.pickOrCreateOne))
		return true;
	else
		return false;
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

function _getDataValue(d) { return d.text; }
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

function _showViewStringCell(obj, cell)
{
	var sectionObj = d3.select(obj);
	
	var itemsDiv = sectionObj.selectAll("ol");

	var setupItems = function(items, cell) {
		items.append("div")
			.classed("description-text growable", true)
			.text(_getDataValue)
			.each(_pushTextChanged);
	}
		
	function addedValue(eventObject, newValue)
	{
		setupItems(appendItem(d3.select(eventObject.data), newValue), this);
	}
	setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), addedValue);
	
	var items = appendItems(itemsDiv, cell.data);
	setupItems(items, cell);
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

function editUniqueDateStampDayOptional(sectionObj, placeholder, value, inputType)
{
	var itemsDiv = crf.appendItemList(sectionObj);
	
	var items = itemsDiv.append('li');
	items.each(function(d)
	{
		var input = new DateInput(this);
		d3.select(this).selectAll('.date-row')
			.classed('growable', true);
			
		if (value && value.length > 0)
			input.value(value);
	});
}

function getUniqueDateStampDayOptionalValue(sectionObj)
{
	var dateRow = sectionObj.selectAll('.date-row');
	var input = dateRow.node().dateInput;
	return input.value();
}

function _showEditStringCell(obj, cell, inputType)
{
	var sectionObj = d3.select(obj).classed("string", true);
	var itemsDiv = crf.appendItemList(sectionObj);
	
	if (cell.isUnique())
	{
		var items = appendUniqueItems(itemsDiv, cell.data);
	
		items.append("input")
			.classed('growable', true)
			.attr("type", inputType)
			.attr("placeholder", cell.field.label || cell.field.name)
			.property("value", _getDataValue);
	}
	else
	{
		itemsDiv.classed('deletable-items', true);
		var items = appendItems(itemsDiv, cell.data);
		
		var appendControls = function(items, cell)
		{				
			crf.appendDeleteControls(items);

			items.append("input")
				.classed('growable', true)
				.attr("type", inputType)
				.attr("placeholder", cell.field.label || cell.field.name)
				.property("value", _getDataValue);
				
			crf.appendConfirmDeleteControls(items);
			var dials = $(itemsDiv.node()).find('li>button:first-of-type');
			crf.showDeleteControls(dials, 0);
		}
		
		appendControls(items, cell);

		function appendNewValue(eventObject, newValue)
			{
				var div = appendItem(d3.select(eventObject.data), newValue);
				
				appendControls(div, this);
				$(eventObject.data).css('display', "");	
			}
		setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), appendNewValue);
		sitePanel.setupItemsDivHandlers(itemsDiv, cell);
			
		crv.appendAddButton(sectionObj, cell.field.name, function()
			{
				var newValue = cell.addNewValue();
				unblockClick();
			});
	}
}

function _showEditDateStampDayOptionalCell(obj)
{
	var sectionObj = d3.select(obj).classed("string", true);
	var itemsDiv = crf.appendItemList(sectionObj);
	
	function appendInputs(items)
	{
	    items.each(function(d)
	    {
	    	var input = new DateInput(this);
	    	d3.select(this).selectAll('.date-row')
	    		.classed('growable', true);
	    		
	    	var newValue = d.text;
	    	if (newValue && newValue.length > 0)
 				input.value(newValue);
	    });
	}
	
	if (this.isUnique())
	{
		var items = appendUniqueItems(itemsDiv, this.data);
		appendInputs(items);
	}
	else
	{
		itemsDiv.classed('deletable-items', true);
		var divs = appendItems(itemsDiv, this.data);
		
		var appendControls = function(items, cell)
		{	
			
			crf.appendDeleteControls(innerDivs);
			inputContainers = innerDivs.append("div")
				.classed("string-input-container growable", true);						
			appendInputs(inputContainers);
			crf.appendConfirmDeleteControls(items);
			var dials = $(itemsDiv.node()).find('li>button:first-of-type');
			crf.showDeleteControls(dials, 0);
		}
		
		appendControls(divs, this);

		function appendNewValue(eventObject, newValue)
			{
				var div = appendItem(d3.select(eventObject.data), newValue);
				
				appendControls(div, this);	
				$(eventObject.data).css('display', "");	
			}
		setupOnViewEventHandler(this, "valueAdded.cr", itemsDiv.node(), appendNewValue);
		sitePanel.setupItemsDivHandlers(itemsDiv, this);
		
		var cell = this;	
		crv.appendAddButton(sectionObj, cell.field.name, function()
			{
				var newValue = cell.addNewValue();
				unblockClick();
			});
	}
}

function _showEditTranslationCell(obj, cell, inputType)
{
	var sectionObj = d3.select(obj).classed("string translation", true);
	var itemsDiv = crf.appendItemList(sectionObj);
	
	function appendInputControls(items)
	{
		var languageSelect = items.append('select');
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
		
		items.append("input")
			.classed("growable", true)
			.attr("type", "text")
			.attr("placeholder", cell.field.label || cell.field.name)
			.property("value", _getDataValue);
	}
	
	if (cell.isUnique())
	{
		var items = appendUniqueItems(itemsDiv, cell.data);
		appendInputControls(items);
	}
	else
	{
		itemsDiv.classed('deletable-items', true);
		var divs = appendItems(itemsDiv, cell.data);
		
		var appendControls = function(items, cell)
		{	
			crf.appendDeleteControls(items);
			appendInputControls(items);
			crf.appendConfirmDeleteControls(items);
			var dials = $(itemsDiv.node()).find('li>button:first-of-type');
			crf.showDeleteControls(dials, 0);
		}
		
		appendControls(divs, cell);

		function appendNewValue(eventObject, newValue)
			{
				var item = appendItem(d3.select(eventObject.data), newValue);
				
				appendControls(item, this);	
				$(eventObject.data).css('display', "");	
			}
		setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), appendNewValue);
		sitePanel.setupItemsDivHandlers(itemsDiv, cell);
			
		crv.appendAddButton(sectionObj, cell.field.name, function()
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

function _clickEditObjectValue(d, backText)
{
	if (_isPickCell(d.cell))
	{
		if (prepareClick('click', 'pick object: ' + d.description()))
		{
			try {
				showPickObjectPanel(d.cell, d);
			} catch(err) { cr.syncFail(err); }
		}
	}
	else
	{
		if (prepareClick('click', 'edit object: ' + d.description()))
		{
			try {
				var getSavePromise;
				if (d.cell.parent)
					getSavePromise = null;
				else
				{
					/* Test case: Create an Organization, Site an Offering all in one operation. */
					getSavePromise = promiseImportCells;
				}
				showEditObjectPanel(d.cell, d, backText, revealPanelLeft, getSavePromise);
			} catch(err) { cr.syncFail(err); }
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

function appendUniqueItems(container, data)
{
	return container.selectAll('li')
		.data(data)
		.enter()
		.append("li");
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
			$(sectionNode).css('display', _thisPanel2Div.isEmptyItems(itemsDiv) ? 'none' : "");
			
			/* Make sure the section gets shown if a value is added to it. */
			var checkDisplay = function(eventObject, newValue)
			{
				$(eventObject.data).css('display', _thisPanel2Div.isEmptyItems(itemsDiv) ? 'none' : "");
			}
			setupOnViewEventHandler(cell, "valueAdded.cr valueDeleted.cr changed.cr", sectionNode, checkDisplay);
			sitePanel.setupItemsDivHandlers(itemsDiv, cell);
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
	
	/**
	 *	Adds UI elements to display the contents of the specified cells.
	 */
	SitePanel.prototype.showViewCells = function(cells)
	{
		var _this = this;
		var sections = this.mainDiv.appendSections(cells.filter(function(cell) 
				{ 
					return cell.field.descriptorType != cr.descriptorTypes.byText 
				}))
			.classed("cell view", true)
			.classed("unique", function(cell) { return cell.isUnique(); })
			.classed("multiple", function(cell) { return !cell.isUnique(); })
			.each(function(cell) {
					var section = d3.select(this);
					cell.appendLabel(this);
					var itemsDiv = crf.appendItemList(section);
					_this.mainDiv.appendCellData(this, cell);
				});
		
		return sections;
	}
	
	/**
	 *	Adds UI elements to edit the specified cells.
	 *	labelTest is an optional function that takes a cell and determines
	 *	if the cell should be labeled. If not specified, then cells that are
	 *	not unique or are not descriptorTypes.byText are labeled.
	 */
	SitePanel.prototype.showEditCells = function(cells, labelTest)
	{
		labelTest = labelTest !== undefined ? labelTest :
			function(cell) 
			    { 
			    	return !cell.isUnique() ||
							cell.field.descriptorType != cr.descriptorTypes.byText; 
				};
						
		var _this = this;
		return this.mainDiv.appendSections(cells)
			.classed("cell edit", true)
			.classed("unique", function(cell) { return cell.isUnique(); })
			.classed("multiple", function(cell) { return !cell.isUnique(); })
			.each(function(cell) {
					if (labelTest(cell))
						cell.appendLabel(this);
						
					cell.showEdit(this, _this.headerText);
				});
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
		if (containerNode)
		{
			var _this = this;
			var inputBox = this.appendInput(containerNode, placeholder);
		
			this.inputBox = inputBox.node();
			$(this.inputBox).on("input", function() { _this.textChanged() });
		}
		
		SearchOptionsView.call(this, containerNode, chunkerType);
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

/* Gets the text for the header of a view panel based on the specified data. */
function getViewPanelHeader(objectData)
{
	var headerText = objectData.description();
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
								try
								{
									showClickFeedback(this);
				
									showEditObjectPanel(cell, objectData, header, revealPanelUp);
								}
								catch(err)
								{
									cr.syncFail(err);
								}
							}
							d3.event.preventDefault();
						});
					editButton.append("span").text(crv.buttonTexts.edit);
				}
	
				var panel2Div = sitePanel.appendScrollArea();

				var headerDiv = panel2Div.appendHeader();
		
				var updateHeader = function(eventObject)
				{
					var newText = getViewPanelHeader(this);
					sitePanel.panelDiv.attr("headerText", newText);
					d3.select(eventObject.data).text(newText);
				}
				objectData.on("changed.cr", headerDiv.node(), updateHeader);
				$(headerDiv.node()).on("remove", null, objectData, function(eventObject)
				{
					eventObject.data.off("changed.cr", updateHeader);
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
	{
		d = containerCell.addNewValue();
		d.instance(new cr.Instance());
	}
	else if (!d.instance())
		d.instance(new cr.Instance());
		
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
						  containerCell.parent && containerCell.parent.id(), 
						  initialData))
				   .then(function(newData)
						  {
							containerCell.addValue(newData);
						  });
}

var EditPanel = (function() {
	EditPanel.prototype = new SitePanel();
	EditPanel.prototype.navContainer = null;
	EditPanel.prototype.lastNewIDKey = 1;
	
	/** Sets up event handles that ensure that the specified itemsDiv is properly hidden
		or shown depending on the specified changes.
	 */
	EditPanel.prototype.setupItemsDivHandlers = function(itemsDiv, container, eventType)
	{
		node = itemsDiv.node();
		function checkVisible(eventObject)
		{
			checkItemsDisplay(eventObject.data);
		}
		setupOnViewEventHandler(container, eventType, node, checkVisible);
		checkItemsDisplay(node);
	}

/* Obsolete
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
						
					promise(containerCell, objectData, sections.data())
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
		doneButton.append("span").text(crv.buttonTexts.add);
		return doneButton;
	}
*/
	
	EditPanel.prototype.appendTextChanges = function(section, oldValue, changes, key)
	{
		var newValue = section.selectAll('input').node().value;
		if (newValue != oldValue)
			changes[key] = newValue;
		return this;
	}
	
	EditPanel.prototype.appendTimeChanges = function(section, oldValue, changes, key)
	{
		var newValue = section.selectAll('input').node().value;
		try
		{
			if (!newValue)
				newValue = null;
			else
				newValue = Date.parse(newValue).toString("HH:mm");
		}
		catch(err)
		{
			newValue = null;
		}
		if (newValue != oldValue)
			changes[key] = newValue;
		return this;
	}
	
	EditPanel.prototype.appendEnumerationChanges = function(section, getValue, oldValue, changes, key)
	{
		var newValue = getValue(section.selectAll('.description-text').text());
		if (newValue != oldValue)
			changes[key] = newValue;
		return this;
	}
	
	EditPanel.prototype.appendDateChanges = function(dateEditor, oldValue, changes, key)
	{
		var newValue = dateEditor.dateWheel.value();
		if (newValue != oldValue)
			changes[key] = newValue;
		return this;
	}
	
	EditPanel.prototype.appendTextEditor = function(section, placeholder, value, inputType)
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
	
	EditPanel.prototype.appendDateEditor = function(section, placeholder, value, minDate, maxDate)
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
			maxDate.setUTCFullYear(minDate.getUTCFullYear() + 50);
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
		
		dateSpan.on('click', function()
			{
				if (!reveal.isVisible())
				{
					try
					{
						var done = function()
						{
							dateSpan.classed('site-active-text', true);
							reveal.show({}, 200, undefined, function()
								{
									dateWheel.onShowing();
								});
							notSureReveal.show({duration: 200});
						}
						if (!_this.onFocusInOtherInput(reveal, done))
						{
							done();
						}
					}
					catch (err)
					{
						cr.asyncFail(err);
					}
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
					notSureReveal.show({done: done});
				});
			
		}
		
		if (value)
			dateWheel.value(value);
		else
			dateWheel.clear();

		return {dateWheel: dateWheel, 
		    wheelReveal: reveal,
			notSureReveal: notSureReveal,
			hideWheel: hideWheel,
			showWheel: showWheel,
		};
	}
	
	EditPanel.prototype.appendDateStampDayOptionalEditor = function(section, placeholder, value, inputType)
	{
		var itemsDiv = crf.appendItemList(section);
	
		var items = itemsDiv.append('li');
		items.each(function(d)
		{
			var input = new DateInput(this);
			d3.select(this).selectAll('.date-row')
				.classed('growable', true);
			
			if (value)
				input.value(value);
		});
	}
	
	EditPanel.prototype.appendTranslationEditor = function(section, container, sectionLabel, placeholder, addEventType, deleteEventType, changedEventType, translations, nameType)
	{
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
		var items = appendItems(itemsDiv, translations);
		
		var onConfirmDelete = function(d)
			{
				var _thisItem = $(this).parents('li')[0];

				/* Test case: Delete an existing value in a cell that has multiple values. */
				if (prepareClick('click', 'confirm delete: ' + d.description()))
				{
					try {
						cr.removeElement(translations, d);
					    removeItem(_thisItem, unblockClick);
					} catch(err) { cr.syncFail(err); }
				}
			}
	
		function appendItemControls(items)
		{
			crf.appendDeleteControls(items);
			appendInputControls(items);
			crf.appendConfirmDeleteControls(items, onConfirmDelete);
			var dials = $(itemsDiv.node()).find('li>button:first-of-type');
			crf.showDeleteControls(dials, 0);
			items.each(function(d)
				{
					$(d).on(deleteEventType, this, function(eventObject)
						{
							var item = d3.select(eventObject.data);
							item.remove();
						});
				});
		}
		appendItemControls(items);

		crv.appendAddButton(section, placeholder, function()
			{
				var newValue = new nameType();
				newValue.setDefaultValues();
				container.names().push(newValue);
				newValue.parent(container);
					
				var item = itemsDiv.append('li')
					.datum(newValue);
				appendItemControls(item);
				itemsDiv.style('display', null);
				unblockClick();
			});
	}
	
	EditPanel.prototype.appendEnumerationEditor = function(section, newValue)
	{
		var itemsDiv = crf.appendItemList(section);

		var items = itemsDiv.append('li');

		var divs = items.append('div')
			.classed('description-text growable unselectable', true)
			.text(newValue);
			
		return items;
	}
	
	EditPanel.prototype.appendTranslationChanges = function(section, translations, changes, key)
	{
		var subChanges = [];
		var _this = this;
		
		var items = section.selectAll('li');
		items.each(function(d)
			{
				var item = d3.select(this);
				var newText = item.selectAll('input').node().value;
				var newLanguageCode = crv.languages[item.selectAll('select').node().selectedIndex].code;
				if (d.id() && this.getAttribute('isDeleted'))
				{
					subChanges.push({'delete': d.id()});
				}
				else if (!d.id())
				{
					
					if (newText)
					{
						_this.lastNewIDKey += 1;
						subChanges.push({'add': "name" + _this.lastNewIDKey.toString(), 
										 'text': newText,
										 'languageCode': newLanguageCode});
					}
				}
				else
				{
					var itemChanges = {};
					var foundChange = false;
					if (newText != d.text())
					{
						itemChanges['text'] = newText;
						foundChange = true;
					}
					if (newLanguageCode != d.language())
					{
						itemChanges['languageCode'] = newLanguageCode;
						foundChange = true;
					}
					if (foundChange)
					{
						itemChanges['id'] = d.id();
						subChanges.push(itemChanges);
					}
				}
			});
		
		if (subChanges.length > 0)
			changes[key] = subChanges;
	}
	
	EditPanel.prototype.pushTranslationChanges = function(parent, translations, changes, resultType)
	{
		console.assert(translations);
		
		changes.forEach(function(change)
		{
			if ('delete' in change)
			{
				var d = translations.find(function(t)
					{ return t.id() == change['delete']; })
				cr.removeElement(translations, d);	
			}
			else if ('add' in change)
			{
				var d = new resultType();
				d.clientID(change['add']);
				d.parent(parent);
				translations.push(d);
			}
		});
		return this;
	}
	
	EditPanel.prototype.createRoot = function(objectData, header, onShow)
	{
		SitePanel.prototype.createRoot.call(this, objectData, header, "edit", onShow);
		this.navContainer = this.appendNavContainer();
		this.appendScrollArea();
	}

	function EditPanel()
	{
	}
	
	return EditPanel;
})();

var EditItemPanel = (function () {
	EditItemPanel.prototype = new EditPanel();

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
	
	EditItemPanel.prototype.createRoot = function(onShow)
	{
		var _this = this;
		EditPanel.prototype.createRoot.call(this, this._controller.newInstance(), this.panelTitle, onShow);

		this.navContainer.appendLeftButton()
			.on("click", function()
				{
					if (prepareClick('click', _this.panelTitle + ' Cancel'))
					{
						_this.hide();
					}
					d3.event.preventDefault();
				})
			.append('span').text(crv.buttonTexts.cancel);
		
		var doneButton = this.navContainer.appendRightButton();
			
		this.navContainer.appendTitle(this.panelTitle);
		
		doneButton.on("click", function()
			{
				if (prepareClick('click', _this.panelTitle + ' done'))
				{
					this.focus();	// To eliminate focus from a previously selected item.
					showClickFeedback(this);
		
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
		.append("span").text(this._controller.oldInstance() ? crv.buttonTexts.done : crv.buttonTexts.add);
		
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
	PickFromListPanel.prototype = new SitePanel();
	
	PickFromListPanel.prototype.createRoot = function(datum, headerText, oldDescription)
	{
		SitePanel.prototype.createRoot.call(this, datum, headerText, "list", revealPanelLeft);
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'pick from list panel: Cancel'))
				{
					_this.hideRight(unblockClick);
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text(crv.buttonTexts.cancel);
	
		navContainer.appendTitle(this.title);

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
				
		items.filter(function(d, i)
			{
				return _this.datumDescription(d) === oldDescription;
			})
			.insert("span", ":first-child").classed("glyphicon glyphicon-ok", true);
				
		items.on('click', function(d, i)
				{
					if (_this.datumDescription(d) === oldDescription)
						return;
					
					if (prepareClick('click', _this.datumDescription(d)))
					{
						try
						{
							$(_this.node()).trigger('itemPicked.cr', _this.datumDescription(d));
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
		SitePanel.call(this);
	}
	
	return PickFromListPanel;

})();

/* Obsolete
function showEditObjectPanel(containerCell, objectData, backText, onShow, getSavePromise) {
	var successFunction = function(cells)
	{
		var header;
		if (objectData && objectData.id())
			header = crv.buttonTexts.edit;
		else
			header = "New " + containerCell.field.name;
		var sitePanel = new EditPanel(objectData, header, onShow);

		var doneButton;
		if (objectData && objectData.id())
		{
			if (onShow === revealPanelUp)
				doneButton = sitePanel.navContainer.appendRightButton();
			else
				doneButton = sitePanel.navContainer.appendLeftButton();
			doneButton.append("span").text(crv.buttonTexts.done);
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
				// Test case: Set the address for a site where the site
				// has been previously saved without an address.
				f = promiseSaveCells;
			}
			else
			{
				// Test case: add a new service to the services panel.
				f = promiseCreateObjectFromCells;
			}
			
			var doneButton = sitePanel.appendAddButton(f, containerCell, objectData, sections.data());
			
			sitePanel.appendBackButton();
		}
		sitePanel.navContainer.appendTitle(header);
		
		onShow(sitePanel.node());
	}
	
	if (objectData && (objectData.id() || objectData.getCells()))
		objectData.promiseCells()
			.then(function()
				{
					successFunction(objectData.getCells());
				}, cr.syncFail);
	else
		/* Test case: Add a new site to an organization. * /
		containerCell.getConfiguration()
			.then(successFunction, cr.syncFail);
}

/* 
	Displays a panel for adding a root object. 
 * /
function showAddRootPanel(containerCell, onShow) {
	var successFunction = function(cells)
	{
		var header = "New " + containerCell.field.name;
			
		var sitePanel = new EditPanel(null, header, onShow);

		var doneButton = sitePanel.appendAddButton(promiseCreateObjectFromCells, containerCell, null, cells);
		
		sitePanel.appendBackButton();

		sitePanel.navContainer.appendTitle(header);
		
		onShow(sitePanel.node());
	}
	
	// Test case: Display panel to add a new term. * /
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
		backButton.append("span").text(crv.buttonTexts.done);
		
		var checkEdit = function()
		{
			if (cr.signedinUser.systemAccess())
			{
				var editButton = navContainer.appendRightButton()
					.on("click", function(d) {
						if (prepareClick('click', 'view roots object panel: Edit'))
						{
							try
							{
								showClickFeedback(this);
								showEditRootObjectsPanel(cell, "Edit " + header, sortFunction);
							} catch(err) { cr.syncFail(err); }
						}
						d3.event.preventDefault();
					});
				editButton.append("span").text(crv.buttonTexts.edit);
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
				/* Show all of the items. * /
				panel2Div.selectAll("li")
					.style('display', null);
			}
			else
			{
				/* Show the items whose description is this.value * /
				panel2Div.selectAll("li")
					.style('display', function(d)
						{
							if (d.description().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return 'none';
						});
			}
		}
	
		sitePanel.appendSearchBar(textChanged);

		var panel2Div = sitePanel.appendScrollArea();
		
		var section = panel2Div.append("section")
			.classed("cell multiple", true);
		var itemsDiv = crf.appendItemList(section)
			.classed("hover-items border-above", true)
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

		setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), addedFunctionWithSort);
		setupOnViewEventHandler(cell, "changed.cr", itemsDiv.node(), dataChangedFunction);
	
		appendViewCellItems(itemsDiv, cell, 
			function(d) {
				if (prepareClick('click', 'view root object: ' + d.description()))
				{
					try {
						showViewObjectPanel(cell, d, sitePanel.node().getAttribute("headerText"), revealPanelLeft);
					} catch(err) { cr.syncFail(err); }
				}
			});

		sitePanel.setupItemsDivHandlers(itemsDiv, cell);
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
	backButton.append("span").text(crv.buttonTexts.done);
	
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
			/* Show all of the items. * /
			panel2Div.selectAll("li")
				.style('display', null);
		}
		else
		{
			/* Show the items whose description is this.value * /
			panel2Div.selectAll("li")
				.style('display', function(d)
					{
						if (d.description().toLocaleLowerCase().indexOf(val) >= 0)
							return null;
						else
							return 'none';
					});
		}
	}

	sitePanel.appendSearchBar(textChanged);

	var panel2Div = sitePanel.appendScrollArea();
	
	var section = panel2Div.append("section")
		.classed("cell multiple", true);
	var itemsDiv = crf.appendItemList(section)
		.classed("hover-items deletable-items border-above", true)
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

	setupOnViewEventHandler(cell, "valueAdded.cr", itemsDiv.node(), addedFunctionWithSort);
	setupOnViewEventHandler(cell, "changed.cr", itemsDiv.node(), dataChangedFunction);

	appendEditCellItems(itemsDiv, cell, 
		function(d) {
			if (prepareClick('click', 'edit cell item: ' + d.description()))
			{
				try {
					showEditObjectPanel(cell, d, header, revealPanelLeft);
				} catch(err) { cr.syncFail(err); }
			}
		});
	sitePanel.setupItemsDivHandlers(itemsDiv, cell);
	var dials = $(sitePanel.node()).find('ol.deletable-items>li>button:first-of-type');
	crf.showDeleteControls(dials);

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
 * /
function showPickObjectPanel(cell, oldData) {
	var failFunction = syncFailFunction;
	
	function selectAllSuccessFunction(rootObjects) {
		if (!("pickObjectPath" in cell.field && cell.field.pickObjectPath))
		{
			rootObjects.sort(function(a, b)
				{
					return a.description().localeCompare(b.description());
				});
		}
	
		var panelDatum;
		if (oldData && oldData.id)
			panelDatum = oldData;	// Replacing an existing object.
		else
			panelDatum = cell;		// Adding a new object.
		var sitePanel = new SitePanel();
		sitePanel.createRoot(panelDatum, cell.field.name, "list");

		var navContainer = sitePanel.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'pick object panel: Cancel'))
				{
					try {
						sitePanel.hideRight(unblockClick);
					} catch(err) { cr.syncFail(err); }
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text(crv.buttonTexts.cancel);
		
		navContainer.appendTitle(cell.field.name);

		var textChanged = function(){
			var val = this.value.toLocaleLowerCase();
			if (val.length === 0)
			{
				// Show all of the items.
				panel2Div.selectAll("li")
					.style('display', null);
			}
			else
			{
				// Show the items whose description is this.value
				panel2Div.selectAll("li")
					.style('display', function(d)
						{
							if (d.description().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return 'none';
						});
			}
		}
	
		sitePanel.appendSearchBar(textChanged);

		var panel2Div = sitePanel.appendScrollArea();
		
		function buttonClicked(d) {
			// d is the ObjectValue that the user clicked.
			var successFunction = function()
			{
				sitePanel.hideRight(unblockClick);
			}
			
			if (prepareClick('click', 'pick object panel: ' + d.description()))
			{
				try
				{
					if (!oldData)
					{
						// Test case: Add an item to a cell that can contain multiple items. 
						if (cell.parent && cell.parent.id())	// In this case, we are adding an object to an existing object.
						{
							// Test case: Add a service to an offering that has been saved.
							cr.updateValues([cell.getAddCommand(d)], [cell])
								.then(successFunction, cr.syncFail);
						}
						else 
						{
							oldData = cell.addNewValue();
							
							// In this case, we are replacing an old value for
							// an item that was added to the cell but not saved;
							// a placeholder or a previously picked value.
							oldData.updateData({instanceID: d.id(), description: d.description()});
							oldData.triggerDataChanged();
							successFunction();
						}
					}
					else if (d.id() === oldData.id()) {
						// Test case: Choose the same item as was previously selected for this item.
						successFunction();
					}
					else if (oldData.id)
					{
						if (d.id())
						{
							// Test case: Choose a different item as was previously selected for this item.
							cr.updateObjectValue(oldData, d, -1, successFunction, cr.syncFail);
						}
						else
						{
							// Test case: Choose none for a unique item that was previously specified.
							oldData.deleteValue()
								.then(successFunction, cr.syncFail);
						}
					}
					else if (d.id())
					{
						// Test case: Set the value of a unique item in a cell where the current value is None.
						if (cell.parent && cell.parent.id())	// In this case, we are adding an object to an existing object.
						{
							// Test case: Set the state of an address that was previously saved without a state. 
							cr.updateValues([cell.getAddCommand(d)], [oldData])
								.then(successFunction, cr.syncFail);
						}
						else 
						{
							// In this case, we are replacing an old value for
							// an item that was added to the cell but not saved;
							// a placeholder or a previously picked value.
							oldData.instance(d.instance());
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
			buttons.insert("span", ":first-child")
				.classed('glyphicon', true)
				.classed("glyphicon-ok", 
				function(d) { return d.description() == oldData.description(); });
		}
	
		sitePanel.showLeft().then(unblockClick);
	}
	
	if (cell.field.pickObjectPath)
	{
		var pickObjectPath = cell.field.pickObjectPath;
		if (pickObjectPath.indexOf("parent") === 0 &&
			">:=</".indexOf(pickObjectPath.charAt(6)) >= 0)
		{
			var currentObject = cell.parent;
			pickObjectPath = pickObjectPath.slice(6);
			while (currentObject != null &&
				   pickObjectPath.indexOf("::reference(") === 0 &&
				   !currentObject.id())
			{
				currentObject = currentObject.cell.parent;
				pickObjectPath = pickObjectPath.slice("::reference(".length);
				// While the next string is quoted, skip it.
				while (pickObjectPath[0] === '"')
				{
					pickObjectPath = pickObjectPath.slice(1);
					pickObjectPath = pickObjectPath.slice(pickObjectPath.indexOf('"')+1);
				}
				// Skip over the next close parenthesis
				pickObjectPath = pickObjectPath.slice(pickObjectPath.indexOf(')')+1);
			}
			if (currentObject != null && currentObject.id())
			{
				// Test case: edit the inquiry access group of an organization
				pickObjectPath = currentObject.id()+pickObjectPath;
				cr.getData({path: pickObjectPath, fields: ['none']})
					.then(selectAllSuccessFunction, cr.syncFail);
			}
			else
				cr.syncFail("The container has not yet been saved.");
		}
		else
			// Test case: edit the public access of an organization.
			cr.getData({path: pickObjectPath, fields: ['none']})
				.then(selectAllSuccessFunction, cr.syncFail);
	}
	else
		// Test case: edit the name of a field of a configuration of a term.
		cr.getData({path: cell.field.ofKind, fields: ['none']})
			.then(selectAllSuccessFunction, cr.syncFail);
}
Obsolete */

