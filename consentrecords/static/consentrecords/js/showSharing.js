var crs = {
	privileges: {},
	privilegeIDs: {},
	sortedAccessRecords: {"_find": [], "_read": [], "_write": [], "_administer": []},
	sortedAccessors: {"_find": [], "_read": [], "_write": [], "_administer": []},
	
	initialize: function()
	{
		privileges = {};
		privilegeIDs = {};
		sortedAccessRecords = {"_find": [], "_read": [], "_write": [], "_administer": []};
		sortedAccessors = {"_find": [], "_read": [], "_write": [], "_administer": []};
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
			var cell = a.getValueByName("_privilege");
			if (cell && cell.data.length > 0)
			{
				var d = cell.data[0];
				if (d.getValueID() in privileges)
				{
					var sa = crs.sortedAccessRecords[privileges[d.getValueID()]];
					sa.append(a);
					sa = crs.sortedAccessors[privileges[d.getValueID()]];
					var userCell = a.getValueByName("_user");
					var groupCell = a.getValueByName("_group");
					for (var j = 0; j < userCell.data.length; ++j)
					{
						sa.append(userCell.data[j]);
					}
					for (var j = 0; j < groupCell.data.length; ++j)
					{
						sa.append(groupCell.data[j]);
					}
				}
			}
		}
	}
	
	function getPrivileges(enumerators)
	{
		for (var i = 0; i < enumerators.length; ++i)
		{
			var e = enumerators[i];
			crs.privileges[e.getValueID()] = e.getDescription();
			crs.privilegeIDs[e.getDescription()] = e.getValueID();
		}
		var path = "#" + userInstance.getValueID() + '>"_access record"';
		cr.getData(path, ["parents"], successFunction1, asyncFailFunction);
	}

	var privilegePath = "_uuname[_uuname=_privilege]>enumerator";
	crp.getData(privilegePath, [], getPrivileges, asyncFailFunction);
}

/*
	This function should be called within a prepareClick block. 
 */
function pickAccessor(header, containerPanel, successFunction)
{
	var panelDiv = createPanel(containerPanel, null, header)
		.classed("list-panel", true);

	var navContainer = panelDiv.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", handleCloseRightEvent);
	backButton.append("span").text("Done");

	var centerButton = navContainer.appendTitle(header);

	var searchText = "";
	function show_users()
	{
		var val = this.value.toLocaleLowerCase();
		var inputBox = this;
		
		if (val.length == 0)
		{
			panel2Div.selectAll("section").remove();
			searchText = val;
		}
		else
		{
			var startVal = val;
						
			function show_user(user, containerPanel)
			{
				showViewOnlyObjectPanel(user, user.cell, undefined, containerPanel);
			}
	
			var selectAllSuccess = function(userObjects)
			{
				if (inputBox.value.toLocaleLowerCase() == startVal)
				{
					panel2Div.selectAll("section").remove();
					var sections = panel2Div.appendSections(userObjects);
					var buttons = appendViewButtons(sections)
						.on("click", function(user) {
							if (prepareClick())
							{
								successFunction(user, panelDiv);
							}
							d3.event.preventDefault();
						});
					var infoButtons =  buttons.insert("div", ":first-child")
						.classed("info-button right-fixed-width-div", true)
						.on("click", function(user) {
							if (prepareClick())
							{
								show_user(user, panelDiv);
							}
							d3.event.preventDefault();
						});
					drawInfoButtons(infoButtons);

					searchText = startVal;
				}
			}
			
			cr.selectAll("_user[_email^="+val+"]", selectAllSuccess, asyncFailFunction);
		}
	}
	
	var searchBar = panelDiv.appendSearchBar(show_users);

	var panel2Div = panelDiv.appendScrollArea();
	panel2Div.appendAlertContainer();

	showPanelLeft(panelDiv.node());
}

function addAccessor(userInstance, accessorLevel)
{
	if (prepareClick())
	{
		var _this = this;
		var panelDiv = d3.select($(this).parents(".site-panel")[0]);
		var accessRecordCell = userInstance.getCell("_access record");
		function successFunction(pickedUser, panelDiv)
		{
			var accessorID = privilegeIDs[accessorLevel];
			if (sortedAccessRecords[accessorLevel].length == 0)
			{
				function _createAccessRecordSuccess(newData)
				{
					sortedAccessRecords[accessorLevel].append(newData);
					var itemsDiv = d3.select($(_this).parents(".cell-div")[0].children(".cell-items")[0]);
					_getOnValueAddedFunction(panelDiv, accessRecordCell, userInstance.getValueID(), true, true, showViewObjectPanel, revealPanelLeft)(null, newData);
				}

				// Create an instance of an access record with this accessor level
				// and this user.
				var field = accessRecordCell.field;
				var initialData = {"_privilege": privilegeIDs[accessorLevel],
								   "_user": pickedUser.getValueID() };
				cr.createInstance(field, userInstance.getValueID(), initialData, _createAccessRecordSuccess, syncFailFunction);
			}
			else
			{
				// Add this user to the access record associated with this accessor level.
			}
		}
		pickAccessor("Add User Or Group", panelDiv, successFunction);
	}
}