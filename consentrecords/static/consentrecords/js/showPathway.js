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
	
	/* Overrides SearchView.prototype.isButtonVisible */
	PickOrCreateSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (button == this.customButton.node())
		{
			if (compareText.length === 0)
				return false;
			var data = this.listPanel.selectAll("li").data();
			return !data.find(function(d) {
				if (typeof(d) !== "object")
					return false;
					
				/* If there are not cells, check the cache */
				if (!d.cells)
					d = crp.getInstance(d.getValueID());
				return d.cells.find(function(cell)
					{
						return (cell.field.descriptorType == "_by text" ||
							    cell.field.descriptorType == "_by first text") &&
							cell.data.find(function(d) { return d.getDescription().toLocaleLowerCase() === compareText; });
					});
				});
		}
		else
		{
			if (compareText.length === 0)
				return true;
			
			return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
		}
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
	
	PickOrCreateSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		buttons = buttons.filter(function(d, i) { return i > 0; });
			
		buttons.remove();
		this.customButton.style("display", "none");
	}
	
	PickOrCreateSearchView.prototype.cancelSearch = function()
	{
		SearchView.prototype.cancelSearch.call(this);
		this.customButton.style("display", this.inputText().length > 0 ? null : "none");
	}
	
	PickOrCreateSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.customButton.selectAll('.description-text').text('"{0}"'.format(val));
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
			PanelSearchView.call(this, sitePanel, pickDatum.cell.field.name, undefined, GetDataChunker);
			var _this = this;
			this.customButton = appendViewButtons(this.appendButtonContainers(["Custom"]), 
						function(buttons)
						{
							var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
							leftText.text("");
						}
				)
				.on("click", function(d, i) {
					d3.event.preventDefault();

					if (prepareClick('click', 'Custom Button: ' + _this.inputText()))
					{
						var newText = _this.inputText();
						var compareText = newText.toLocaleLowerCase()
						var d = _this.getDataChunker.buttons().data().find(function(d)
							{
								return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText;
							});
						if (d) {
							sitePanel.updateValues(d, null);
							return;
						}

						if (newText.length == 0)
						{
							sitePanel.updateValues(null, null);
						}
						else
						{
							function done(newInstances)
							{
								if (newInstances.length == 0)
									sitePanel.updateValues(null, newText);
								else
									sitePanel.updateValues(newInstances[0], null);
							}
				
							var searchPath = _this.searchPath("");
							if (searchPath.length > 0)
							{
								cr.selectAll({path: searchPath+'[_name='+'"'+newText+'"]', 
									end: 50, done: done, fail: syncFailFunction});
							}
							else
							{
								sitePanel.updateValues(null, newText);
							}
						}
					}
				})
				.style("display", "none");
				
			/* Load the inputBox */
			if (!this.createDatum.isEmpty())
				this.inputText(this.createDatum.getDescription());
			else if (!this.pickDatum.isEmpty())
			{
				if (!this.pickDatum.cells && !crp.getInstance(this.pickDatum.getValueID()))
					this.inputText(this.pickDatum.getDescription());
				else
				{
					var cells = this.pickDatum.cells ||
						crp.getInstance(this.pickDatum.getValueID()).cells;
					var cell = cells.find(function(cell)
						{
							return (cell.field.descriptorType == "_by text" ||
								cell.field.descriptorType == "_by first text") &&
								cell.data.find(function(d) { return !d.isEmpty(); });
						});
					if (cell)
					{
						var d = cell.data.find(function(d) { return !d.isEmpty(); });
						if (d)
							this.inputText(d.getDescription());
						else
							this.inputText(this.pickDatum.getDescription());
					}
					else
						this.inputText(this.pickDatum.getDescription());
				}
			}
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
			
			/* Override the hasPersistentValues function of the pickDatum and createDatum
				cells to ensure that they aren't deleted (which they would be for the MyTagsCell).
			 */
			var f = function() {
				return true;
			}
			var oldF = this.pickDatum.cell.hasPersistentValues;
			this.pickDatum.cell.hasPersistentValues = f;
			this.createDatum.cell.hasPersistentValues = f;
			cr.updateValues(initialData, sourceObjects,
				function () {
					_this.pickDatum.cell.hasPersistentValues = oldF;
					_this.createDatum.cell.hasPersistentValues = oldF;
					_this.hide();
					},
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

var PickOrCreateTagPanel = (function () {
	PickOrCreateTagPanel.prototype = new PickOrCreatePanel();
	
	function PickOrCreateTagPanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		
		if (this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateTagPanel;
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
		var field = {capacity: "_multiple values", name: "Tag", label: "Tags"};
		cr.Cell.call(this, field);
		this.offeringCell = offeringCell;
	}
	
	return OfferingServiceCell;
})();

var MyTagsCell = (function () {
	MyTagsCell.prototype = new PickOrCreateCell();
	
	MyTagsCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateTagPanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function MyTagsCell(pickCell, createCell) {
		var field = {capacity: "_multiple values", name: "tag", label: "My Tags"};
		PickOrCreateCell.call(this, pickCell, createCell, field);
	}
	return MyTagsCell;
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
		SitePanel.call(this, previousPanel, experience, "Edit Experience", "edit", showFunction);
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();
		var bottomNavContainer = this.appendBottomNavContainer();

		navContainer.appendRightButton()
			.classed("default-link", true)
			.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this,
						function()
						{
							myTagsCell.data.forEach(function(d)
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
			
		var shareButton = bottomNavContainer.appendLeftButton()
			.classed("share", true)
			.on('click', function()
				{
					if (prepareClick('click', 'delete experience'))
					{
						new ExperienceShareOptions(_this.node(), experience);
					}
				});
		shareButton.append("img")
			.attr("src", shareImagePath);
		
			
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
		var myTagsCell = new MyTagsCell(serviceCell, userServiceCell);
		var sections = this.showEditCells([myTagsCell]);
	}
	
	return EditExperiencePanel;
})();

var ExperienceShareOptions = (function () {

	function ExperienceShareOptions(panelNode, experience)
	{
		var dimmer = d3.select(panelNode).append('div')
			.classed('dimmer', true);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		function onCancel(e)
		{
			if (prepareClick('click', 'Cancel'))
			{
				$(emailAddExperienceButton.node()).off('blur');
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					unblockClick();
				});
				$(dimmer.node()).animate({opacity: 0}, {duration: 400, complete:
					function()
					{
						dimmer.remove();
					}});
			}
			e.preventDefault();
		}
		
		var addToMyPathwayButton = div.append('button')
			.text("Add to My Pathway")
			.classed("site-active-text", true)
			.on("click", function()
				{
					if (prepareClick('click', "Add to My Pathway"))
					{
						var tempExperience = new Experience(experience);
						tempExperience.user = cr.signedinUser;
						var newPanel = new NewExperienceFinishPanel(panel.node(), tempExperience, null, revealPanelUp);
						showPanelUp(newPanel.node(), function()
							{
								$(emailAddExperienceButton.node()).off('blur');
								panel.remove();
								dimmer.remove();
								unblockClick();
							});
					}
				});
				
		$(addToMyPathwayButton.node()).on('blur', onCancel);
		
		var emailAddExperienceButton = div.append('button')
			.text("Email Add Experience Link")
			.classed("site-active-text", true)
			.on("click", function()
				{
					if (prepareClick('click', "Email Add Experience Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							window.location = 'mailto:?subject=Add%20Pathway%20Experience&body=Here is a link to add an experience to your pathway: {0}/add/{1}.'
										.format(window.location.origin, experience.getValueID());
							unblockClick();
						});
						$(dimmer.node()).animate({opacity: 0}, {duration: 400, complete:
							function()
							{
								dimmer.remove();
							}});
					}
				});
				
		$(emailAddExperienceButton.node()).on('blur', onCancel);
		
		var cancelButton = div.append('button')
			.text("Cancel")
			.classed("site-active-text", true);
		
		$(cancelButton.node()).click(onCancel);
		
		$(dimmer.node()).animate({opacity: 0.3}, 400);
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(emailAddExperienceButton.node()).focus();
				unblockClick();
			}});
		$(dimmer.node()).mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ExperienceShareOptions;
})();

