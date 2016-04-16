var PickOrCreateSearchView = (function () {
	PickOrCreateSearchView.prototype = new PanelSearchView();
	PickOrCreateSearchView.prototype.pickDatum = null;
	PickOrCreateSearchView.prototype.createDatum = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	PickOrCreateSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'pick ' + d.getDescription()))
		{
			this.sitePanel.updateValues(d, null);
		}
		d3.event.preventDefault();
	}
	
	/* Overrides SearchView.setupInputBox */
	PickOrCreateSearchView.prototype.setupInputBox = function()
	{
		if (!this.createDatum.isEmpty())
		{
			this.inputBox.value = this.createDatum.getDescription();
			$(this.inputBox).trigger("input");
		}
		else if (!this.pickDatum.isEmpty())
		{
			this.inputBox.value = this.pickDatum.getDescription();
			$(this.inputBox).trigger("input");
		}
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	PickOrCreateSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
	}
	
	/* Overrides SearchView.searchPath */
	PickOrCreateSearchView.prototype.searchPath = function(val)
	{
		if (val.length == 0)
			/* This case occurs when searching for sites within an organization. */
			return this.pickDatum.cell.field.ofKindID;
		else
		{
			var symbol = (val.length < 3) ? "^=" : "*=";
			return this.pickDatum.cell.field.ofKindID+'[?'+symbol+'"'+val+'"]';
		}
	}
	
	PickOrCreateSearchView.prototype.showObjects = function(foundObjects)
	{
		var buttons = SearchView.prototype.showObjects.call(this, foundObjects);
			
		if (!this.pickDatum.isEmpty())
		{
			var _this = this;
			buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return d.getDescription() == _this.pickDatum.getDescription(); });
		}
		return buttons;
	}
	
	function PickOrCreateSearchView(sitePanel, pickDatum, createDatum)
	{
		if (sitePanel)
		{
			this.pickDatum = pickDatum;
			this.createDatum = createDatum;
			PanelSearchView.call(this, sitePanel, pickDatum.cell.field.name, undefined, GetDataChunker /* Could be SelectAllChunker */);
		}
		else
			PanelSearchView.call(this);
	}
	
	return PickOrCreateSearchView;
})();

var PickOrCreatePanel = (function () {
	PickOrCreatePanel.prototype = new SitePanel();
	PickOrCreatePanel.prototype.navContainer = null;
	PickOrCreatePanel.prototype.searchView = null;
	PickOrCreatePanel.prototype.done = null;
	PickOrCreatePanel.prototype.pickDatum = null;
	PickOrCreatePanel.prototype.createDatum = null;
	
	PickOrCreatePanel.prototype.onClickCancel = function()
	{
		if (prepareClick('click', 'Cancel'))
		{
			this.hide();
		}
		d3.event.preventDefault();
	}
	
	PickOrCreatePanel.prototype.save = function(initialData, sourceObjects)
	{
		if (initialData.length > 0)
		{
			var _this = this;
			cr.updateValues(initialData, sourceObjects,
				function () { _this.hide(); },
				syncFailFunction);
		}
		else
			this.hide();
	}
	
	PickOrCreatePanel.prototype.updateValues = function(newValue, newText)
	{
		if (newValue && newValue.getValueID() === this.pickDatum.getValueID())
			this.hide();
		else if (!newValue && newText && newText === this.createDatum.text)
			this.hide();
		else 
		{
			var initialData = [];
			var sourceObjects = [];
			if (newValue)
			{
				if (this.pickDatum.cell.parent && this.pickDatum.cell.parent.getValueID())	/* In this case, we are adding an object to an existing object. */
				{
					this.pickDatum.appendUpdateCommands(0, newValue, initialData, sourceObjects);
					this.createDatum.appendUpdateCommands(0, null, initialData, sourceObjects);
					this.save(initialData, sourceObjects);
				}
				else 
				{
					/* In this case, we are replacing an old value for
					   an item that was added to the cell but not saved;
					   a placeholder or a previously picked value.
					 */
					this.pickDatum.updateFromChangeData({instanceID: newValue.getValueID(), description: newValue.getDescription()});
					this.createDatum.updateFromChangeData({text: null});
					this.pickDatum.triggerDataChanged();
					this.hide();
				}
			}
			else
			{
				if (this.pickDatum.cell.parent && this.pickDatum.cell.parent.getValueID())	/* In this case, we are adding an object to an existing object. */
				{
					this.pickDatum.appendUpdateCommands(0, null, initialData, sourceObjects);
					this.createDatum.appendUpdateCommands(0, newText, initialData, sourceObjects);
					this.save(initialData, sourceObjects);
				}
				else 
				{
					/* In this case, we are replacing an old value for
					   an item that was added to the cell but not saved;
					   a placeholder or a previously picked value.
					 */
					this.pickDatum.updateFromChangeData({instanceID: null, description: "None"});
					this.createDatum.updateFromChangeData({text: newText});
					this.createDatum.triggerDataChanged();
					this.hide();
				}
			}
			
		}
	}
	
	PickOrCreatePanel.prototype.onClickDone = function(d, i) {
		d3.event.preventDefault();

		if (prepareClick('click', 'Done'))
		{
			var newText = this.searchView.inputText();
			var compareText = newText.toLocaleLowerCase()
			var d = this.searchView.getDataChunker.buttons().data().find(function(d)
				{
					return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText;
				});
			if (d) {
				this.updateValues(d, null);
				return;
			}

			if (newText.length == 0)
			{
				this.updateValues(null, null);
			}
			else
			{
				var _this = this;
				function done(newInstances)
				{
					if (newInstances.length == 0)
						_this.updateValues(null, newText);
					else
						_this.updateValues(newInstances[0], null);
				}
				
				var searchPath = this.searchView.searchPath("");
				if (searchPath.length > 0)
				{
					cr.selectAll({path: searchPath+'[_name='+'"'+newText+'"]', 
						end: 50, done: done, fail: syncFailFunction});
				}
				else
				{
					this.updateValues(null, newText);
				}
			}
		}
	}
	
	PickOrCreatePanel.prototype.getTitle = function()
	{
		return this.pickDatum.cell.field.name;
	}
	
	PickOrCreatePanel.prototype.createSearchView = function()
	{
		return new PickOrCreateSearchView(this, this.pickDatum, this.createDatum);
	}
	
	function PickOrCreatePanel(previousPanelNode, pickDatum, createDatum, done)
	{
		if (previousPanelNode === undefined)
		{
			SitePanel.call(this);
		}
		else
		{
			SitePanel.call(this, previousPanelNode, pickDatum, pickDatum.cell.field.name, "list");
			this.pickDatum = pickDatum;
			this.createDatum = createDatum;
			this.done = done;
			this.navContainer = this.appendNavContainer();

			var _this = this;
			var backButton = this.navContainer.appendLeftButton()
				.on("click", function()
				{
					_this.onClickCancel();
				});
			backButton.append("span").text("Cancel");
			
			this.navContainer.appendRightButton()
				.on("click", function()
				{
					_this.onClickDone();
				})
				.append("span").text("Done");

			var title = this.getTitle();
			if (title)
				this.navContainer.appendTitle(title);
			
			this.searchView = this.createSearchView();

			showPanelLeft(this.node(), unblockClick);
		}
	}
	return PickOrCreatePanel;
})();

var PickOrCreateSiteSearchView = (function () {
	PickOrCreateSiteSearchView.prototype = new PickOrCreateSearchView();
	
	PickOrCreateSiteSearchView.prototype.searchPath = function(val)
	{
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID())
		{
			return "#"+organization.getValueID()+">Sites>"+PickOrCreateSearchView.prototype.searchPath.call(this, val);
		}
		else
			return "";
	}
	
	PickOrCreateSiteSearchView.prototype.textCleared = function()
	{
		PickOrCreateSearchView.prototype.textCleared.call(this);
		
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID())
		{
			this.startSearchTimeout("");
		}
	}
	
	function PickOrCreateSiteSearchView(sitePanel, pickDatum, createDatum)
	{
		PickOrCreateSearchView.call(this, sitePanel, pickDatum, createDatum);
	}
	
	return PickOrCreateSiteSearchView;
	
})();

var PickOrCreateSitePanel = (function () {
	PickOrCreateSitePanel.prototype = new PickOrCreatePanel();
	
	PickOrCreateSitePanel.prototype.createSearchView = function()
	{
		return new PickOrCreateSiteSearchView(this, this.pickDatum, this.createDatum);
	}
	
	function PickOrCreateSitePanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID() && this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateSitePanel;
})();

var PickOrCreateOfferingSearchView = (function () {
	PickOrCreateOfferingSearchView.prototype = new PickOrCreateSearchView();
	
	PickOrCreateOfferingSearchView.prototype.searchPath = function(val)
	{
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID())
		{
			return "#"+site.getValueID()+">Offerings>"+PickOrCreateSearchView.prototype.searchPath.call(this, val);
		}
		else
			return "";
	}
	
	PickOrCreateOfferingSearchView.prototype.textCleared = function()
	{
		PickOrCreateSearchView.prototype.textCleared.call(this);
		
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID())
		{
			this.startSearchTimeout("");
		}
	}
	
	function PickOrCreateOfferingSearchView(sitePanel, pickDatum, createDatum)
	{
		PickOrCreateSearchView.call(this, sitePanel, pickDatum, createDatum);
	}
	
	return PickOrCreateOfferingSearchView;
	
})();

var PickOrCreateOfferingPanel = (function () {
	PickOrCreateOfferingPanel.prototype = new PickOrCreatePanel();
	
	PickOrCreateOfferingPanel.prototype.createSearchView = function()
	{
		return new PickOrCreateOfferingSearchView(this, this.pickDatum, this.createDatum);
	}
	
	function PickOrCreateOfferingPanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID() && this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateOfferingPanel;
})();

var PickOrCreateMarkerPanel = (function () {
	PickOrCreateMarkerPanel.prototype = new PickOrCreatePanel();
	
	function PickOrCreateMarkerPanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		
		if (this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateMarkerPanel;
})();

var PickOrCreateValue = (function() {
	PickOrCreateValue.prototype = new cr.CellValue();
	PickOrCreateValue.prototype.pickValue = null;
	PickOrCreateValue.prototype.createValue = null;
	
	PickOrCreateValue.prototype.getDescription = function()
	{
		if (!this.pickValue.isEmpty())
			return this.pickValue.getDescription();
		else
			return this.createValue.getDescription();
	}
	
	PickOrCreateValue.prototype.isEmpty = function()
	{
		return this.pickValue.isEmpty() && this.createValue.isEmpty();
	}
	
	/* In this subclass, delete the pickValue, the createValue and then
		trigger a delete event for this.
	 */
	PickOrCreateValue.prototype.deleteValue = function(done, fail)
	{
		if (!this.cell)
			throw ("PickOrCreateValue cell is not set up");
			
		var _this = this;
		this.pickValue.deleteValue(
			function(oldValue)
			{
				_this.createValue.deleteValue(
					function(oldCreateValue) {
						_this.triggerDeleteValue();
						done(_this);
					}, 
					fail);
			},
			fail);
	}
	
	PickOrCreateValue.prototype.removeUnusedValue = function()
	{
		var pickValue = this.pickValue;
		var createValue = this.createValue;

		if (!pickValue.cell.isUnique())
		{
			if (!pickValue.id)
			{
				pickValue.triggerDeleteValue();
			}
			if (!createValue.id)
			{
				createValue.triggerDeleteValue();
			}
		}
	}
	
	PickOrCreateValue.prototype.pushTextChanged = function(textNode)
	{
		var pickValue = this.pickValue;
		var createValue = this.createValue;
		
		var _this = this;
		var onValueChanged = function(eventObject)
		{
			$(eventObject.data).trigger("dataChanged.cr", eventObject.data);
		}
		var f = function(eventObject)
		{
			d3.select(eventObject.data).text(_this.getDescription());
		}
		$(this.pickValue).on("valueAdded.cr dataChanged.cr valueDeleted.cr", null, this, onValueChanged);
		$(this.createValue).on("valueAdded.cr dataChanged.cr valueDeleted.cr", null, this, onValueChanged);
		$(this).on("dataChanged.cr", null, textNode, f);
		$(textNode).on("remove", null, null, function() {
			$(_this.pickValue).off("valueAdded.cr dataChanged.cr valueDeleted.cr", null, onValueChanged);
			$(_this.createValue).off("valueAdded.cr dataChanged.cr valueDeleted.cr", null, onValueChanged);
			$(_this).off("dataChanged.cr", null, f);
		});
	}
	
	function PickOrCreateValue(pickValue, createValue)
	{
		cr.CellValue.call(this);
		this.pickValue = pickValue;
		this.createValue = createValue;
	}
	
	return PickOrCreateValue;
})();

var PickOrCreateCell = (function () {
	PickOrCreateCell.prototype = new cr.Cell();
	PickOrCreateCell.prototype.pickCell = null;
	PickOrCreateCell.prototype.createCell = null;
	PickOrCreateCell.prototype.editPanel = null;
	
	PickOrCreateCell.prototype.isEmpty = function()
	{
		return this.pickCell.isEmpty() && this.createCell.isEmpty();
	}
	
	PickOrCreateCell.prototype.pickedObject = function(d)
	{
		if (pickedObject.getValueID() == this.pickCell.data[0].getValueID())
			this.editPanel.hide();
		else
		{
			var initialData = [];
			var sourceObjects = [];
			this.editPanel.appendUpdateCommands(initialData, sourceObjects);
			if (initialData.length > 0)
			{
				cr.updateValues(initialData, sourceObjects, 
					function() {
						this.editPanel.hide();
					}, 
					syncFailFunction);
			}
			else
				this.editPanel.hide();
		}
	}

	PickOrCreateCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreatePanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	PickOrCreateCell.prototype.showValueAdded = function()
	{
		/* getOnValueAddedFunction(true, true, showEditObjectPanel)); */
	}
	
	PickOrCreateCell.prototype.newValue = function()
	{
		return new PickOrCreateValue(this.pickCell.newValue(), this.createCell.newValue());
	}
	
	PickOrCreateCell.prototype.addNewValue = function()
	{
		var pickValue = this.pickCell.addNewValue();
		var createValue = this.createCell.addNewValue();
		var newValue = new PickOrCreateValue(pickValue, createValue);
		newValue.cell = this;
		this.data.push(newValue);
		$(this).trigger("valueAdded.cr", newValue);
		return newValue;
	};
	
	PickOrCreateCell.prototype.updateCell = function(sectionObj)
	{
		/* Do nothing */
	};
	
	PickOrCreateCell.prototype.appendData = function(initialData)
	{
		this.pickCell.appendData(initialData);
		this.createCell.appendData(initialData);
	}

	PickOrCreateCell.prototype.showEdit = function(obj, containerPanel)
	{
		var sectionObj = d3.select(obj);

		this.appendLabel(obj);
		var itemsDiv = sectionObj.append("ol");
			
		var _this = this;
		
		if (this.isUnique())
		{
			itemsDiv.classed("right-label", true);

			sectionObj.classed("btn row-button", true)
				.on("click", function(cell) {
						if (prepareClick('click', 'pick or create cell: ' + _this.field.name))
						{
							var sitePanelNode = $(this).parents(".site-panel")[0];
							var pickDatum = _this.pickCell.data[0];
							var createDatum = _this.createCell.data[0];
							_this.showPickOrCreatePanel(pickDatum, createDatum, sitePanelNode);
						}
					});
		}

		function showAdded(oldData, previousPanelNode)
		{
			var pickDatum = oldData.pickValue;
			var createDatum = oldData.createValue;
			_this.showPickOrCreatePanel(pickDatum, createDatum, previousPanelNode);
		}
	
		var addedFunction = getOnValueAddedFunction(true, true, showAdded);
		var onValueAdded = function(eventObject, newValue)
		{
			var item = addedFunction.call(this, eventObject, newValue);
			newValue.pushTextChanged(item.selectAll(".description-text").node());
		}

		$(this).on("valueAdded.cr", null, itemsDiv.node(), onValueAdded);
		$(itemsDiv.node()).on("remove", null, this, function(eventObject)
			{
				$(eventObject.data).off("valueAdded.cr", null, onValueAdded);
			});
			
		var divs = appendItems(itemsDiv, this.data);
	
		if (!this.isUnique())
			appendConfirmDeleteControls(divs);
		
		var buttons = appendRowButtons(divs);

		if (!this.isUnique())
		{
			buttons.on("click", function(d) {
					if (prepareClick('click', 'edit ' + _this.field.name))
					{
						var sitePanelNode = $(this).parents(".site-panel")[0];
						var pickDatum = d.pickValue;
						var createDatum = d.createValue;
						_this.showPickOrCreatePanel(d.pickValue, d.createValue, sitePanelNode);
					}
				});
			appendDeleteControls(buttons);
		}

		appendRightChevrons(buttons);	
		
		appendButtonDescriptions(buttons)
			.each(function(d)
					{
						d.pushTextChanged(this);
					});
	
		if (!this.isUnique())
		{
			/* newValue is generated by the newValue() function, above. */
			function done(newValue)
			{
				var sitePanelNode = $(obj).parents(".site-panel")[0];
				_this.showPickOrCreatePanel(newValue.pickValue, newValue.createValue, sitePanelNode);
			}
		
			crv.appendAddButton(sectionObj, done);
			_setupItemsDivHandlers(itemsDiv, this);
		}
	}

	function PickOrCreateCell(pickCell, createCell, field)
	{
		if (pickCell === undefined)
		{
			cr.Cell.call(this);
		}
		else {
			if (field === undefined)
				field = {
					name: pickCell.field.name,
					capacity: "_unique value",
				};
			cr.Cell.call(this, field);
			this.pickCell = pickCell;
			this.createCell = createCell;
			if (this.isUnique())
				this.pushValue(new PickOrCreateValue(this.pickCell.data[0], this.createCell.data[0]));
			else
			{
				/* Make a copy of the create cell data before creating the PickOrCreateValue objects for the pickPairs */
				var _this = this;
				var createData = this.createCell.data.concat([]);
				var pickPairs = this.pickCell.data.map(function(d) { return new PickOrCreateValue(d, _this.createCell.addNewValue()); });
				var createPairs = createData.map(function(d) { return new PickOrCreateValue(_this.pickCell.addNewValue(), d); });
				pickPairs.forEach(function(d) { _this.pushValue(d); });
				createPairs.forEach(function(d) { _this.pushValue(d); });
			}
		}
	}

	return PickOrCreateCell;
})();

var PickOrCreateOrganizationCell = (function () {
	PickOrCreateOrganizationCell.prototype = new PickOrCreateCell();
	PickOrCreateOrganizationCell.prototype.experience = null;
	
	function PickOrCreateOrganizationCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Organization"),
							  experience.getCell("User Entered Organization"));
		this.experience = experience;
	}
	
	return PickOrCreateOrganizationCell;
})();

var PickOrCreateSiteCell = (function () {
	PickOrCreateSiteCell.prototype = new PickOrCreateCell();
	PickOrCreateSiteCell.prototype.experience = null;
	
	PickOrCreateSiteCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateSitePanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function PickOrCreateSiteCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Site"),
							  experience.getCell("User Entered Site"));
		this.experience = experience;
	}
	
	return PickOrCreateSiteCell;
})();

var PickOrCreateOfferingCell = (function () {
	PickOrCreateOfferingCell.prototype = new PickOrCreateCell();
	PickOrCreateOfferingCell.prototype.experience = null;
	
	PickOrCreateOfferingCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateOfferingPanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function PickOrCreateOfferingCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Offering"),
							  experience.getCell("User Entered Offering"));
		this.experience = experience;
	}
	
	return PickOrCreateOfferingCell;
})();

var ConfirmAlert = (function () {

	function ConfirmAlert(panelNode, confirmText, done, cancel)
	{
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		var confirmButton = div.append('button')
			.text(confirmText)
			.classed("text-danger", true)
			.on("click", function()
				{
					if (prepareClick('click', confirmText))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							done();
						});
					}
				});
		div.append('button')
			.text("Cancel")
			.on("click", function()
				{
					if (prepareClick('click', 'Cancel'))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							cancel();
						});
					}
				});
		
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		$(confirmButton.node()).on('blur', function()
			{
				if (prepareClick('blur', confirmText))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
				}
			});
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ConfirmAlert;
})();

/* A special implementation of a cell that can be viewed and displays the
	services of the offering in the specified offering cell. */
var OfferingServiceCell = (function () {
	OfferingServiceCell.prototype = new cr.Cell();
	OfferingServiceCell.prototype.offeringCell = null;
	
	OfferingServiceCell.prototype.isEmpty = function()
	{
		if (this.offeringCell.isEmpty())
			return true;
		return this.offeringCell.data[0].getCell("Service").isEmpty();
	}
	
	OfferingServiceCell.prototype.checkCells = function(done, fail)
	{
		if (!this.offeringCell.isEmpty())
		{
			var offering = this.offeringCell.data[0];
			offering.checkCells([],
				done,
				fail);
		}
	}
	
	OfferingServiceCell.prototype.clear = function(obj)
	{
		d3.select(obj).selectAll('ol>li').remove();
	}
	
	OfferingServiceCell.prototype.show = function(obj, containerPanel)
	{
		this.clear(obj);
		var _this = this;
		this.checkCells(function() {
							var offering = _this.offeringCell.data[0];
							offering.getCell("Service").show(obj, containerPanel);
						},
						asyncFailFunction);
	}
	
	OfferingServiceCell.prototype.setupHandlers = function(obj, containerPanel)
	{
		var offeringCell = this.offeringCell;
		var _this = this;
		var checkView = function(e)
		{
			if (offeringCell.isEmpty())
			{
				_this.clear(obj);
				$(obj).css("display", "none");
			}
			else
				_this.checkCells(function()
					{
						_this.show(obj, containerPanel);
						$(obj).css("display", !_this.isEmpty() ? "" : "none");
					}, 
					asyncFailFunction);
		}
		$(offeringCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", checkView);
		$(obj).on("remove", function(e)
		{
			$(offeringCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", checkView);
		});
	}
	
	function OfferingServiceCell(offeringCell) {
		var field = {capacity: "_multiple values", name: "Marker", label: "Markers"};
		cr.Cell.call(this, field);
		this.offeringCell = offeringCell;
	}
	
	return OfferingServiceCell;
})();

var MyMarkersCell = (function () {
	MyMarkersCell.prototype = new PickOrCreateCell();
	
	MyMarkersCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateMarkerPanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function MyMarkersCell(pickCell, createCell) {
		var field = {capacity: "_multiple values", name: "marker", label: "My Markers"};
		PickOrCreateCell.call(this, pickCell, createCell, field);
	}
	return MyMarkersCell;
})();

var EditExperiencePanel = (function () {
	EditExperiencePanel.prototype = new SitePanel();
	EditExperiencePanel.prototype.experience = null;
	
	EditExperiencePanel.prototype.handleDeleteButtonClick = function()
	{
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmAlert(this.node(), "Delete Experience", 
				function() { 
					_this.datum().deleteValue(
						function() { _this.hidePanelDown(unblockClick) },
						syncFailFunction);
				}, 
				function() { 
					unblockClick();
				});
		}
	}
	
	function EditExperiencePanel(experience, previousPanel, showFunction) {
		SitePanel.call(this, previousPanel, experience, "Edit Experience", "edit session", showFunction);
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();
		var bottomNavContainer = this.appendBottomNavContainer();

		navContainer.appendRightButton()
			.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this,
						function()
						{
							myMarkersCell.data.forEach(function(d)
								{ d.removeUnusedValue(); });
						});
				})
			.append("span").text("Done");

		navContainer.appendTitle("Edit Experience");
		
		var _this = this;
		bottomNavContainer.appendRightButton()
			.on("click", 
				function() {
					_this.handleDeleteButtonClick();
				})
			.append("span").classed("text-danger", true).text("Delete");
			
		cells = [new PickOrCreateOrganizationCell(experience),
				 new PickOrCreateSiteCell(experience),
				 new PickOrCreateOfferingCell(experience),
				 experience.getCell("Start"),
				 experience.getCell("End"),
				];
				
		this.showEditCells(cells);
		
		var startSection = panel2Div.selectAll(":nth-child(4)");
		var startDateInput = startSection.selectAll(".date-row").node().dateInput;
		var endSection = panel2Div.selectAll(":nth-child(5)");
		var endDateInput = endSection.selectAll(".date-row").node().dateInput;
		endDateInput.checkMinDate(new Date(startDateInput.value));
		
		$(startDateInput).on('change', function()
		{
			endDateInput.checkMinDate(new Date(startDateInput.value()));
		});
		
		var offeringCell = experience.getCell("Offering");
		var offeringServiceCell = new OfferingServiceCell(offeringCell);
		this.showViewCells([offeringServiceCell])
				 .each(function(cell)
					{
						offeringServiceCell.setupHandlers(this, _this.node());
					});
		
		var serviceCell = experience.getCell("Service");
		var userServiceCell = experience.getCell("User Entered Service");
		var myMarkersCell = new MyMarkersCell(serviceCell, userServiceCell);
		var sections = this.showEditCells([myMarkersCell]);
	}
	
	return EditExperiencePanel;
})();

var AddExperiencePanel = (function () {
	AddExperiencePanel.prototype = new SitePanel();
	AddExperiencePanel.prototype.experience = null;
	
	function AddExperiencePanel(container, experience, previousPanel, showFunction, done) {
		var newExperience = new cr.ObjectValue();
		newExperience.importCells(experience.cells);
		newExperience.privilege = container.privilege;
		newExperience.isDataLoaded = true;
		
		SitePanel.call(this, previousPanel, newExperience, "Add Experience", "edit", showFunction);
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();

		var _this = this;

		doneButton = navContainer.appendRightButton();
		doneButton.append("span").text("Add");
		doneButton.on("click", 	function(d) {
			if (prepareClick('click', 'done adding'))
			{
				showClickFeedback(this);
				
				var initialData = {}
				var sections = panel2Div.selectAll("section");
				sections.each(
					function(cell) {
						if ("updateCell" in cell)
						{
							cell.updateCell(this);
							cell.appendData(initialData);
						}
					});
	
				field = {ofKind: "More Experience", name: "More Experience"};
				cr.createInstance(field, container.getValueID(), initialData, 
					function(newData)
					{
						newData.checkCells([],
							function() {
								if (done)
									done(newData);
							},
						syncFailFunction);
					}, 
					syncFailFunction);
			}
			d3.event.preventDefault();
		});
		
		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'AddExperiencePanel: Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");

		navContainer.appendTitle("Add Experience");
			
		cells = [new PickOrCreateOrganizationCell(newExperience),
				 new PickOrCreateSiteCell(newExperience),
				 new PickOrCreateOfferingCell(newExperience),
				 newExperience.getCell("Start"),
				 newExperience.getCell("End"),
				];
				
		this.showEditCells(cells);
		
		var startSection = panel2Div.selectAll(":nth-child(4)");
		var startDateInput = startSection.selectAll(".date-row").node().dateInput;
		var endSection = panel2Div.selectAll(":nth-child(5)");
		var endDateInput = endSection.selectAll(".date-row").node().dateInput;
		endDateInput.checkMinDate(new Date(startDateInput.value));
		
		$(startDateInput).on('change', function()
		{
			endDateInput.checkMinDate(new Date(startDateInput.value()));
		});
		
		var offeringCell = newExperience.getCell("Offering");
		function showMarkers()
		{
			var offeringServiceCell = new OfferingServiceCell(offeringCell);
			_this.showViewCells([offeringServiceCell])
					 .each(function(cell)
						{
							offeringServiceCell.setupHandlers(this, _this.node());
						});
		
			var serviceCell = newExperience.getCell("Service");
			var userServiceCell = newExperience.getCell("User Entered Service");
			var myMarkersCell = new MyMarkersCell(serviceCell, userServiceCell);
			var sections = _this.showEditCells([myMarkersCell]);
		}
		
		var offering = newExperience.getValue("Offering");
		if (offering && offering.getValueID())
			crp.pushCheckCells(offering, undefined, showMarkers, asyncFailFunction);
		else
			showMarkers();
	}
	
	return AddExperiencePanel;
})();

