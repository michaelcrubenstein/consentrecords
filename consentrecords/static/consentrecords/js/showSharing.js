var crs = {
	privilegesByID: {},
	privileges: [
		{name: "_find", id: "", accessRecords: [], accessors: [], label: "Who Can Find You"},
		{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can Learn About You"},
		{name: "_write", id: "", accessRecords: [], accessors: [], label: "Who Can Add Information About You"},
		{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}],
	
	initialize: function()
	{
		crs.privilegesByID = {};
		crs.privileges = [
			{name: "_find", id: "", accessRecords: [], accessors: [], label: "Who Can Find You"},
			{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can Learn About You"},
			{name: "_write", id: "", accessRecords: [], accessors: [], label: "Who Can Add Information About You"},
			{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}
			];
	}
};

function showSharing(containerDiv) {
	var allExperiences = [];
	
	var panelDiv = $(containerDiv).parents(".site-panel")[0];
	var container = d3.select(containerDiv);
	var containerHeight = parseInt(container.style("height"));
	
	crs.initialize();
	
	function successFunction1(accessRecords)
	{
		// Sort the access records by type.
		for (var i = 0; i < accessRecords.length; ++i)
		{
			var a = accessRecords[i];
			var cell = a.getCell("_privilege");
			if (cell && cell.data.length > 0)
			{
				var d = cell.data[0];
				if (d.getValueID() in crs.privilegesByID)
				{
					var sa = crs.privilegesByID[d.getValueID()];
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
		
		container.selectAll("section").remove();
		var cells = container.selectAll("section")
			.data(crs.privileges)
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
		
		appendButtonDescriptions(buttons, null);

		/* Add one more button for the add Button item. */
		var buttonDiv = cells.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(d) {
				addAccessor.call(this, userInstance, d);
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add user or group");
	}
	
	var accessRecordCell = userInstance.getCell("_access record");
	accessRecordCell.addTarget("valueAdded.cr", containerDiv);
	$(containerDiv).on("remove", function()
	{
		accessRecordCell.removeTrigger("valueAdded.cr", containerDiv);
	});
	$(containerDiv).on("valueAdded.cr", function(e, newData)
		{
			asyncFailFunction("Value Added: " + newData.toString())
		});
	
	function getPrivileges(enumerators)
	{
		for (var i = 0; i < enumerators.length; ++i)
		{
			var e = enumerators[i];
			for (var j = 0; j < crs.privileges.length; ++j)
			{
				var p = crs.privileges[j];
				if (p.name == e.getDescription())
				{
					p.id = e.getValueID();
					crs.privilegesByID[p.id] = p;
					break;
				}
			}
		}
		cr.getData({path: "#" + userInstance.getValueID() + '>"_access record"', 
					fields: ["parents"], 
					done: successFunction1, 
					fail: asyncFailFunction});
	}

	var privilegePath = "_uuname[_uuname=_privilege]>enumerator";
	crp.getData({path: privilegePath, 
				 done: getPrivileges, 
				 fail: asyncFailFunction});
}

/*
	Displays a panel from which the user can choose a user or group.
	
	This function should be called within a prepareClick block. 
 */
function pickAccessor(header, previousPanelNode, successFunction)
{
	var sitePanel = new SitePanel(previousPanelNode, null, header, "list");

	var navContainer = sitePanel.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", handleCloseRightEvent);
	backButton.append("span").text("Done");

	var centerButton = navContainer.appendTitle(header);

	var searchText = "";
	function show_users()
	{
		var val = this.value.toLocaleLowerCase().trim();
		var inputBox = this;
		
		if (val.length == 0)
		{
			panel2Div.selectAll("section").remove();
			searchText = val;
		}
		else
		{
			var startVal = val;
						
			function show_user(user, previousPanelNode)
			{
				showViewOnlyObjectPanel(user, user.cell, undefined, previousPanelNode);
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
								if (prepareClick())
								{
									var cellName =  i < firstGroupIndex ? "_user" : "_group";
									successFunction(user, cellName, sitePanel.node());
								}
								d3.event.preventDefault();
							});
						var infoButtons =  buttons.insert("div", ":first-child")
							.classed("info-button right-fixed-width-div", true)
							.on("click", function(user) {
								if (prepareClick())
								{
									show_user(user, sitePanel.node());
								}
								d3.event.preventDefault();
							});
						drawInfoButtons(infoButtons);

						searchText = startVal;
					}
				}
			
				if (inputBox.value.toLocaleLowerCase().trim() == startVal)
				{
					cr.selectAll({path: '_group[?'+symbol+'"'+val+'"]', limit: 50, done: selectAllSuccess, fail: asyncFailFunction});
					userObjects.sort(sortByDescription);
				}
			}
			
			cr.selectAll({path: '_user[?'+symbol+'"'+val+'"]', limit: 50, done: selectedUsers, fail: asyncFailFunction});
		}
	}
	
	var searchBar = sitePanel.appendSearchBar(show_users);

	var panel2Div = sitePanel.appendScrollArea();
	panel2Div.appendAlertContainer();

	showPanelLeft(sitePanel.node());
}

/*
	Responds to a request to add a user or group to the access records of the specified userInstance.
	
	this is the button that was clicked.
 */
function addAccessor(userInstance, accessorLevel)
{
	if (prepareClick())
	{
		var _this = this;
		var previousPanelNode = $(this).parents(".site-panel")[0];
		var accessRecordCell = userInstance.getCell("_access record");
		function successFunction(pickedUser, cellName, currentPanelNode)
		{
			if (accessorLevel.accessRecords.length == 0)
			{
				function _createAccessRecordSuccess(newData)
				{
					var userCell = newData.getCell(cellName);
					var newValue = userCell.data[0];
					accessorLevel.accessRecords.push(newValue);
					var itemsDiv = $(_this).parents(".cell").children(".cell-items")[0];
					_getOnValueAddedFunction(previousPanelNode, accessRecordCell, userInstance.getValueID(), true, true, showViewObjectPanel, revealPanelLeft).call(itemsDiv, null, newValue);
					hidePanelRight(currentPanelNode);
				}

				// Create an instance of an access record with this accessor level
				// and this user.
				var field = accessRecordCell.field;
				var initialData = {"_privilege": accessorLevel.id,
								   cellName: pickedUser.getValueID() };
				cr.createInstance(field, userInstance.getValueID(), initialData, _createAccessRecordSuccess, syncFailFunction);
			}
			else
			{
				function _createAccessRecordSuccess(newValue)
				{
					accessorLevel.accessRecords.push(newValue);
					var itemsDiv = $(_this).parents(".cell").children(".cell-items")[0];
					_getOnValueAddedFunction(previousPanelNode, accessRecordCell, userInstance.getValueID(), true, true, showViewObjectPanel, revealPanelLeft).call(itemsDiv, null, newValue);
					hidePanelRight(currentPanelNode);
				}

				// Add this user to the access record associated with this accessor level.
				var ar = accessorLevel.accessRecords[0]
				ar.checkCells(undefined, function()
				{
					ar.getCell(cellName).addObjectValue(pickedUser, _createAccessRecordSuccess, syncFailFunction);
				}, syncFailFunction);
			}
		}
		pickAccessor("Add User Or Group", previousPanelNode, successFunction);
	}
}