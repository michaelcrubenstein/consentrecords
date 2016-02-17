/* Produces a function which adds new value view to a container view
	when the new data is added.
	the viewFunction is called when the item is clicked.
 */
function onUserAdded(itemsDivNode, newValue)
{
	var previousPanelNode = $(itemsDivNode).parents(".site-panel")[0];
	var itemsDiv = d3.select(itemsDivNode);
	var item = appendItem(itemsDiv, newValue);
	_checkItemsDivDisplay(itemsDiv);
	
	item.style("display", null);
			   
	appendConfirmDeleteControls(item);
	
	var buttons = appendRowButtons(item);

	buttons.on("click", function(d) {
		if (prepareClick('click', 'view added object: ' + d.getDescription()))
		{
			showViewOnlyObjectPanel(d, previousPanelNode, revealPanelLeft);
		}
	});
	
	appendDeleteControls(buttons);
	appendRightChevrons(buttons);

	appendButtonDescriptions(buttons)
		.each(_pushTextChanged);
}

var SharingPanel = (function() {
	SharingPanel.prototype = new SitePanel();
	SharingPanel.prototype.privilegesByID = null;
	SharingPanel.prototype.privileges = null;
	SharingPanel.prototype.userInstance = null;
	
	SharingPanel.prototype.loadAccessRecords = function(panel2Div, accessRecords)
	{
		var _this = this;
		
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
			.classed("cell multiple", true);
		cells.append("label")
			.text(function(d) { return d.label });
		var itemCells = cells.append("ol")
			.classed("cell-items", true);
	
		var items = appendItems(itemCells, function(d) { return d.accessors });
		
		appendConfirmDeleteControls(items);
	
		var buttons = items.append("div")
			.classed("btn row-button multi-row-content expanding-div", true);
	
		var clickFunction = null;	
		if (clickFunction)
			buttons.on("click", clickFunction);

		appendDeleteControls(buttons);

		appendRightChevrons(buttons);	
	
		appendButtonDescriptions(buttons);

		/* Add one more button for the add Button item. */
		var buttonDiv = cells.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(d) {
				_this.addAccessor(_this.userInstance, d, $(this).parents(".cell").children(".cell-items")[0]);
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add user or group");
		
		showPanelLeft(this.node());
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
		cr.getData({path: "#" + this.userInstance.getValueID() + '>"_access record"', 
					fields: ["parents"], 
					done: function(accessRecords) { _this.loadAccessRecords(panel2Div, accessRecords); }, 
					fail: asyncFailFunction});
	}

	/*
		Responds to a request to add a user or group to the access records of the specified userInstance.
	 */
	SharingPanel.prototype.addAccessor = function(userInstance, accessorLevel, itemsDiv)
	{
		if (prepareClick('click', 'add accessor: ' + accessorLevel.name))
		{
			var accessRecordCell = userInstance.getCell("_access record");
			function successFunction(pickedUser, cellName, currentPanelNode)
			{
				if (accessorLevel.accessRecords.length == 0)
				{
					function _createAccessRecordSuccess(newData)
					{
						newData.checkCells(undefined, function() {
							var userCell = newData.getCell(cellName);
							var newValue = userCell.data[0];
							accessorLevel.accessRecords.push(newData);
							onUserAdded(itemsDiv, newValue);
							hidePanelRight(currentPanelNode);
						},
						syncFailFunction);
					}

					// Create an instance of an access record with this accessor level
					// and this user.
					var field = accessRecordCell.field;
					var initialData = {"_privilege": accessorLevel.id };
					initialData[cellName] = pickedUser.getValueID();
					cr.createInstance(field, userInstance.getValueID(), initialData, _createAccessRecordSuccess, syncFailFunction);
				}
				else
				{
					function _addUserSuccess(newValue)
					{
						onUserAdded(itemsDiv, newValue);
						hidePanelRight(currentPanelNode);
					}

					// Add this user to the access record associated with this accessor level.
					var ar = accessorLevel.accessRecords[0]
					ar.checkCells(undefined, function()
					{
						ar.getCell(cellName).addObjectValue(pickedUser, _addUserSuccess, syncFailFunction);
					}, syncFailFunction);
				}
			}
			new PickSharingUserPanel("Add User Or Group", this.node(), successFunction);
		}
	}

	function SharingPanel(previousPanelNode, userInstance)
	{
		SitePanel.call(this, previousPanelNode, null, "Sharing", "list", revealPanelLeft);
		this.userInstance = userInstance;
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Sharing Done'))
				{
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Done");
		navContainer.appendTitle('Sharing');
		
		var panel2Div = this.appendScrollArea();

		this.privilegesByID =  {};
		this.privileges =  [
			{name: "_find", id: "", accessRecords: [], accessors: [], label: "Who Can Find You"},
			{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can Learn About You"},
			{name: "_write", id: "", accessRecords: [], accessors: [], label: "Who Can Add Information About You"},
			{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}];
	
		var privilegePath = "_uuname[_uuname=_privilege]>enumerator";
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
						
				function show_user(user, previousPanelNode)
				{
					showViewOnlyObjectPanel(user, previousPanelNode);
				}
	
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
							var infoButtons =  buttons.insert("div", ":first-child")
								.classed("info-button right-fixed-width-div", true)
								.on("click", function(user) {
									if (prepareClick('click', 'show info: ' + user.getDescription()))
									{
										show_user(user, _this.node());
									}
									d3.event.preventDefault();
								});
							drawInfoButtons(infoButtons);
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

		showPanelLeft(this.node());
	}
	
	return PickSharingUserPanel;
})();

