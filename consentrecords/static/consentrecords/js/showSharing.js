var SharingPanel = (function() {
	SharingPanel.prototype = new SitePanel();
	SharingPanel.prototype.privilegesByID = null;
	SharingPanel.prototype.privileges = null;
	SharingPanel.prototype.user = null;
	
	SharingPanel.prototype.appendUserControls = function(items)
	{
		appendConfirmDeleteControls(items);
	
		var buttons = appendRowButtons(items);

		var deleteControls = this.appendDeleteControls(buttons);
	
		appendInfoButtons(buttons, this.node());

		appendButtonDescriptions(buttons)
			.each(_pushTextChanged);
		if (!this.inEditMode)
			this.hideDeleteControlsNow($(deleteControls[0]));
		else
			this.showDeleteControls($(deleteControls[0]), 0);
		
		return buttons;
	}

	/* Produces a function which adds new value view to a container view
		when the new data is added.
		the viewFunction is called when the item is clicked.
	 */
	SharingPanel.prototype.onUserAdded = function(itemsDivNode, newValue)
	{
		var itemsDiv = d3.select(itemsDivNode);
		var item = appendItem(itemsDiv, newValue);
		
		this.appendUserControls(item);

		item.style("display", null);
		var newHeight = item.style("height");
		item.style("height", "0");
		$(item.node()).animate({height: newHeight}, 400, "swing");
	}

	SharingPanel.prototype.appendApplyButtons = function(buttons)
	{
		var spans = buttons.append('span').classed('site-active-text', true)
			.text("Accept");
			
		var _this = this;
			
		spans.on('click', function(d) {
				if (prepareClick('click', 'accept access request {0}'.format(d.getDescription())))
				{
					var accessorLevel = _this.privileges[1];
					function done()
					{
						d.deleteValue(function() { 
										unblockClick();
										},
									  syncFailFunction);
					};
					
					_this.addAccess(accessorLevel, d, "_user", done);
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.appendIgnoreButtons = function(buttons)
	{
		var spans = buttons.append('span').classed('site-active-text', true)
			.text("Ignore");
			
		spans.on('click', function(d) {
				if (prepareClick('click', 'ignore access request {0}'.format(d.getDescription())))
				{
					d.deleteValue(function()
						{
							unblockClick();
						},
						syncFailFunction);
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.loadAccessRecords = function(panel2Div, accessRecords)
	{
		var _this = this;
		
		cells = panel2Div.append("section")
			.datum(this.user.getCell("_access request"))
			.classed("cell multiple", true);
		cells.append("label")
			.text("Access Requests");
		itemCells = cells.append("ol")
			.classed("cell-items", true);
			
		items = appendItems(itemCells, cells.datum().data);
		var buttons = items.append("div").classed("btn row-button multi-row-content", true);
		var infoButtons = appendInfoButtons(buttons, this.node());
		
		appendButtonDescriptions(buttons)
			.each(_pushTextChanged);
		var itemButtonDivs = buttons.append('div');
		var applyButtons = this.appendApplyButtons(itemButtonDivs);
		var ignoreButtons = this.appendIgnoreButtons(itemButtonDivs);
			
		// Sort the access records by type.
		for (var i = 0; i < accessRecords.length; ++i)
		{
			var a = accessRecords[i];
			var cell = a.getCell("_privilege");
			if (cell && cell.data.length > 0)
			{
				var d = cell.data[0];
				if (d.getValueID() in this.privilegesByID)
				{
					var sa = this.privilegesByID[d.getValueID()];
					sa.accessRecords.push(a);
					var userCell = a.getCell("_user");
					var groupCell = a.getCell("_group");
					for (var j = 0; j < userCell.data.length; ++j)
					{
						sa.accessors.push(userCell.data[j]);
					}
					for (var j = 0; j < groupCell.data.length; ++j)
					{
						sa.accessors.push(groupCell.data[j]);
					}
				}
			}
		}
	
		var cells = panel2Div.selectAll("section")
			.data(this.privileges)
			.enter()
			.append("section")
			.classed("cell multiple edit", true);
		cells.append("label")
			.text(function(d) { return d.label });
			
		var itemCells = cells.append("ol")
			.classed("cell-items", true);
	
		// Reference the views back to the privileges objects.
		itemCells.each(function(d) { d.itemsDiv = this; });
		
		var items = appendItems(itemCells, function(d) { return d.accessors });
		
		this.appendUserControls(items);
		
		/* Add one more button for the add Button item. */
		var buttonDiv = cells.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(d) {
				_this.addAccessor(_this.user, d, $(this).parents(".cell").children(".cell-items")[0]);
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").text("Add User or Group...");
	}

	SharingPanel.prototype.getPrivileges = function(panel2Div, enumerators)
	{
		var _this = this;
		for (var i = 0; i < enumerators.length; ++i)
		{
			var e = enumerators[i];
			for (var j = 0; j < this.privileges.length; ++j)
			{
				var p = this.privileges[j];
				if (p.name == e.getDescription())
				{
					p.id = e.getValueID();
					this.privilegesByID[p.id] = p;
					break;
				}
			}
		}
		cr.getData({path: "#" + this.user.getValueID() + '>"_access record"', 
					fields: ["parents"], 
					done: function(accessRecords) { _this.loadAccessRecords(panel2Div, accessRecords); }, 
					fail: asyncFailFunction});
	}
	
	SharingPanel.prototype.addAccessRecord = function(accessorLevel, pickedUser, cellName, done)
	{
		var accessRecordCell = this.user.getCell("_access record");
		var field = accessRecordCell.field;
		var initialData = {"_privilege": [{instanceID: accessorLevel.id}] };
		initialData[cellName] = [{instanceID: pickedUser.getValueID() }];
		cr.createInstance(field, this.user.getValueID(), initialData, done, syncFailFunction);
	}
	
	SharingPanel.prototype.addAccessUser = function(accessorLevel, pickedUser, cellName, done)
	{
		var ar = accessorLevel.accessRecords[0]
		ar.checkCells(undefined, function()
		{
			ar.getCell(cellName).addObjectValue(pickedUser, done, syncFailFunction);
		}, syncFailFunction);
	}
	
	SharingPanel.prototype.addAccess = function(accessorLevel, pickedUser, cellName, done)
	{
		var _this = this;
		if (accessorLevel.accessRecords.length == 0)
		{
			function _createAccessRecordSuccess(newData)
			{
				newData.checkCells(undefined, function() {
					var userCell = newData.getCell(cellName);
					var newValue = userCell.data[0];
					accessorLevel.accessRecords.push(newData);
					_this.onUserAdded(accessorLevel.itemsDiv, newValue);
					done();
				},
				syncFailFunction);
			}

			// Create an instance of an access record with this accessor level
			// and this user.
			this.addAccessRecord(accessorLevel, pickedUser, cellName, _createAccessRecordSuccess);
		}
		else
		{
			function _addUserSuccess(newValue)
			{
				_this.onUserAdded(accessorLevel.itemsDiv, newValue);
				done();
			}

			// Add this user to the access record associated with this accessor level.
			this.addAccessUser(accessorLevel, pickedUser, cellName, _addUserSuccess);
		}
	}

	/*
		Responds to a request to add a user or group to the access records of the specified user.
	 */
	SharingPanel.prototype.addAccessor = function(user, accessorLevel, itemsDiv)
	{
		var _this = this;
		
		if (prepareClick('click', 'add accessor: ' + accessorLevel.name))
		{
			var accessRecordCell = user.getCell("_access record");
			function onPick(pickedUser, cellName, currentPanelNode)
			{
				function done()
				{
					hidePanelRight(currentPanelNode);
				}
				
				_this.addAccess(accessorLevel, pickedUser, cellName, done);
			}
			new PickSharingUserPanel("Add User Or Group", this.node(), onPick);
		}
	}

	function SharingPanel(user, previousPanelNode)
	{
		SitePanel.call(this, previousPanelNode, null, "Sharing", "edit sharing", revealPanelUp);
		this.user = user;
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Sharing Done'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("span").text("Settings");
		
		this.inEditMode = false;
		var editButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (_this.inEditMode)
				{
					if (prepareClick('click', 'Done Editing'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text("Edit");
							});
						_this.hideDeleteControls();
						_this.inEditMode = false;
						unblockClick();
					}
				}
				else
				{
					if (prepareClick('click', 'Start Editing'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text("Done");
							});
						_this.showDeleteControls();
						_this.inEditMode = true;
						unblockClick();
					}
				}
			});
		editButton.append('span').text("Edit");
		
		navContainer.appendTitle('Sharing');
		
		var panel2Div = this.appendScrollArea();

		this.privilegesByID =  {};
		this.privileges =  [
			{name: "_find", id: "", accessRecords: [], accessors: [], label: "Who Can Find You"},
			{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can Learn About You"},
			{name: "_write", id: "", accessRecords: [], accessors: [], label: "Who Can Add Information About You"},
			{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}];
	
		var privilegePath = "_term[_name=_privilege]>enumerator";
		crp.getData({path: privilegePath, 
					 done: function(enumerators) { _this.getPrivileges(panel2Div, enumerators); }, 
					 fail: asyncFailFunction});
	}
	
	return SharingPanel;
})();

/*
	Displays a panel from which the user can choose a user or group.
	
	This function should be called within a prepareClick block. 
 */
var PickSharingUserPanel = (function() {
	PickSharingUserPanel.prototype = new SitePanel();
	
	function PickSharingUserPanel(header, previousPanelNode, done)
	{
		SitePanel.call(this, previousPanelNode, null, header, "list");

		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");

		var centerButton = navContainer.appendTitle(header);

		var _this = this;
		function show_users()
		{
			var val = this.value.toLocaleLowerCase().trim();
			var inputBox = this;
		
			if (val.length == 0)
			{
				panel2Div.selectAll("section").remove();
			}
			else
			{
				var startVal = val;
						
				var symbol;
				if (val.length < 3)
					symbol = "^=";
				else
					symbol = "*=";
				
				function sortByDescription(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				}
				function selectedUsers(userObjects)
				{
					var selectAllSuccess = function(groupObjects)
					{
						if (inputBox.value.toLocaleLowerCase().trim() == startVal)
						{
							groupObjects.sort(sortByDescription);
							var firstGroupIndex = userObjects.length;
							allObjects = userObjects.concat(groupObjects);
							panel2Div.selectAll("section").remove();
							var sections = panel2Div.appendSections(allObjects);
							var buttons = appendViewButtons(sections)
								.on("click", function(user, i) {
									var cellName =  i < firstGroupIndex ? "_user" : "_group";
									if (prepareClick('click', 'add ' + cellName + ': ' + user.getDescription()))
									{
										done(user, cellName, _this.node());
									}
									d3.event.preventDefault();
								});
							appendInfoButtons(buttons, _this.node());
						}
					}
			
					if (inputBox.value.toLocaleLowerCase().trim() == startVal)
					{
						cr.selectAll({path: '_group[?'+symbol+'"'+val+'"]', end: 50, done: selectAllSuccess, fail: asyncFailFunction});
						userObjects.sort(sortByDescription);
					}
				}
			
				cr.selectAll({path: '_user[?'+symbol+'"'+val+'"]', end: 50, done: selectedUsers, fail: asyncFailFunction});
			}
		}
	
		this.appendSearchBar(show_users);

		var panel2Div = this.appendScrollArea();

		showPanelLeft(this.node(), unblockClick);
	}
	
	return PickSharingUserPanel;
})();

