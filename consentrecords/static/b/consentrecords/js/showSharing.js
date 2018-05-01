var AccessRequestSectionView = (function () {
	AccessRequestSectionView.prototype = Object.create(UserSectionView.prototype);
	AccessRequestSectionView.prototype.constructor = AccessRequestSectionView;
	
	AccessRequestSectionView.prototype.appendLabel = function(text)
	{
		return this.div.append('label')
			.text(text);
	}
	
	AccessRequestSectionView.prototype.getUser = function(d)
	{
		return d.grantee();
	}
	
	AccessRequestSectionView.prototype.appendDescription = function(div, d)
	{
		UserSectionView.prototype.appendDescription.call(this, div, d);
		
		var leftDivs = d3.select(div);
		var itemButtonDivs = leftDivs.append('div');
		this.sitePanel.appendApplyButtons(itemButtonDivs);
		this.sitePanel.appendIgnoreButtons(itemButtonDivs);
	}
	
	function AccessRequestSectionView(sitePanel, instance)
	{
		UserSectionView.call(this, sitePanel);
		this.div.datum(instance)
			.classed('cell edit multiple', true);
	}
	
	return AccessRequestSectionView;
	
})();

var SharingSectionView = (function() {
	SharingSectionView.prototype = Object.create(UserSectionView.prototype);
	SharingSectionView.prototype.constructor = SharingSectionView;
	
	SharingSectionView.prototype.getUser = function(d)
	{
		return d.grantee();
	}
	
	SharingSectionView.prototype.line1Text = function(d)
	{
		if (d instanceof cr.Group)
			return "";
		else
			return d.fullName();
	}
	
	function SharingSectionView(sitePanel)
	{
		UserSectionView.call(this, sitePanel);
	}
	return SharingSectionView;
})();

var SharingPanel = (function() {
	SharingPanel.prototype = Object.create(GrantsPanel.prototype);
	SharingPanel.prototype.constructor = SharingPanel;
	
	SharingPanel.prototype.helpText = "Add a user to this list to share your path and profile with them without making your path and profile public.";
	SharingPanel.prototype.newUserEmailDocumentation = 
		"Type the email address of someone you want to give access to your profile.";

	/* readPrivilegeIndex is the index into the privileges array that identifies
		read privileges. */
	SharingPanel.prototype.readPrivilegeIndex = 0;
	
	SharingPanel.prototype.appendApplyButtons = function(buttons)
	{
		var spans = buttons.append('span').classed('site-active-text', true)
			.text("Accept");
			
		var _this = this;
			
		spans.on('click', function(d) {
				if (prepareClick('click', 'accept access request {0}'.format(d.description())))
				{
					try
					{
						var accessorLevel = _this.privileges[_this.readPrivilegeIndex];
					
						_this.addAccessRecord(_this.readSectionView, accessorLevel, d.grantee().urlPath())
							.then(function()
								{
									/* Since this item was deleted as part of adding access,  
										process it's deletion. */
									d.triggerDeleted();
									unblockClick();
								}, 
								cr.syncFail);
					}
					catch (err)
					{
						cr.syncFail(err);
					}
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.appendIgnoreButtons = function(buttons)
	{
		var spans = buttons.append('span').classed('site-active-text', true)
			.text("Ignore");
			
		spans.on('click', function(d) {
				if (prepareClick('click', 'ignore access request {0}'.format(d.description())))
				{
					d.deleteData()
						.then(function()
						{
							unblockClick();
						},
						cr.syncFail);
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.loadAccessRecords = function(panel2Div, user)
	{
		var _this = this;
		var sections, itemCells, items;
		var accessRequestSection, accessRequestList;
		
		accessRequestSection = new AccessRequestSectionView(this, this.grantor);
		accessRequestSection.append('label')
			.text("Access Requests");
		accessRequestList = accessRequestSection.appendItemList();
			
		items = appendItems(accessRequestList, user.userGrantRequests(),
			function()
			{
				accessRequestSection.style('display', accessRequestList.selectAll('li').size() ? '' : 'none');
			});
		accessRequestSection.style('display', items.size() ? '' : 'none');
		
		accessRequestSection.appendDescriptions(items);	

		var infoButtonDivs = appendInfoButtons(items, function(d) { return d.grantee(); });
					
		var docSection = new crv.SectionView(this)
			.classed('cell documentation', true);

		var docDiv = docSection.append('div');
		docDiv.text(this.helpText);
		
		// Sort the access records by type.
		var grants = user.userGrants().concat(user.groupGrants());
		for (var i = 0; i < grants.length; ++i)
		{
			var a = grants[i];
			var privilege = a.privilege();
			if (privilege in this.privilegesByID)
			{
				var sa = this.privilegesByID[privilege];
				sa.accessRecords.push(a);
				sa.accessors.push(a);
			}
		}
	
		this.readSectionView = new SharingSectionView(this)
			.datum(this.privileges[0])
			.classed('cell multiple edit', true);
			
		itemCells = this.readSectionView.appendItemList()
			.classed('deletable-items', true);
	
		// Reference the views back to the privileges objects.
		itemCells.each(function(d) { d.itemsDiv = this; });
		
		items = appendItems(itemCells, function(d) { return d.accessors });
		
		this.appendUserControls(this.readSectionView, items);
		
		/* Add one more button for the add Button item. */
		this.readSectionView
			.append('button').classed('btn row-button add-item site-active-text', true)
			.on('click', function(d) {
				_this.addAccessor(this.readSectionView, "Sharing User", d);
			})
			.append('div').text("Add User");
		
	}

	SharingPanel.prototype.getPrivileges = function(panel2Div)
	{
		var _this = this;
		for (var j = 0; j < this.privileges.length; ++j)
		{
			var p = this.privileges[j];
			this.privilegesByID[p.name] = p;
		}
		this.loadAccessRecords(panel2Div, this.grantor);
	}
	
	SharingPanel.prototype.userGrantsPath = function()
	{
		return 'user user grant';
	}
	
	function SharingPanel(user, backButtonText)
	{
		GrantsPanel.call(this, user);
		
		this.createRoot(null, crv.buttonTexts.sharing, revealPanelLeft);
		this.panelDiv.classed('sharing', true);
		
		this.appendBackButton(backButtonText);
		
		this.navContainer.appendTitle(crv.buttonTexts.sharing);
		
		this.appendEditButton();
		
		this.privileges =  [
			{name: cr.privileges.read, id: "", accessRecords: [], accessors: []}];
	
		this.getPrivileges(this.mainDiv);
	}
	
	return SharingPanel;
})();

/*
	Displays a panel from which the user can choose a user or group.
	
	This function should be called within a prepareClick block. 
 */
var PickSharingUserPanel = (function() {
	PickSharingUserPanel.prototype = Object.create(crv.SitePanel.prototype);
	PickSharingUserPanel.prototype.constructor = PickSharingUserPanel;

	PickSharingUserPanel.prototype.title = "Add User"
	PickSharingUserPanel.prototype.badEmailMessage =
		'Please specify a valid email address.';
	
	function PickSharingUserPanel(header, documentationText, done)
	{
		var _this = this;
		this.createRoot(null, header, "list");

		var navContainer = this.appendNavContainer();

		navContainer.appendLeftButton()
			.on('click', function()
				{
					if (prepareClick('click', 'Cancel {0}'.format(_this.title)))
					{
						_this.hide();
					}
				})
			.text('Cancel');
		
		navContainer.appendTitle(header);

		navContainer.appendRightButton()
			.on('click', function()
			{
				if (prepareClick('click', 'Add'))
				{
					try
					{
						var email = d3.select(_this.node()).selectAll('input').node().value;
						function validateEmail(email) 
						{
							var re = /\S+@\S+\.\S\S+/;
							return re.test(email);
						}
						if (!validateEmail(email))
						{
							syncFailFunction(_this.badEmailMessage);
						}
						else
						{
							done('user[email>text="{0}"]'.format(email), _this);
						}
					}
					catch(err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
		    .text(crv.buttonTexts.add);
		
		var panel2Div = this.appendScrollArea();

		var docSection = panel2Div.append('section')
			.classed('cell documentation', true);
			
		var docDiv = docSection.append('div')
			.text(documentationText);
			
		var sectionPanel = panel2Div.append('section')
			.classed('cell edit unique', true);
			
		var itemsDiv = crf.appendItemList(sectionPanel);

		var items = itemsDiv.append('li');	// So that each item appears on its own row.
			
		var emailInput = items.append('input')
			.classed('growable', true)
			.attr('type', 'email')
			.attr('placeholder', "Email");
			
		this.showLeft().then(
			function() {
				emailInput.node().focus();
				unblockClick();
			});
	}
	
	return PickSharingUserPanel;
})();

var AdministratorPanel = (function() {
	AdministratorPanel.prototype = Object.create(GrantsPanel.prototype);
	AdministratorPanel.prototype.constructor = AdministratorPanel;
	
	AdministratorPanel.prototype.helpText = "Add an administrator if you need someone else, such as a parent or guardian, to manage your account for you.";
	AdministratorPanel.prototype.newUserEmailDocumentation = 
		"Type the email address of someone you want to be an administrator for your account.";
	
	AdministratorPanel.prototype.loadAccessRecords = function(panel2Div, grantor)
	{
		var _this = this;
		var sections, itemCells, items;
		var accessRequestSection, accessRequestList;
		
		// Sort the access records by type.
		var grants = grantor.userGrants().concat(grantor.groupGrants());
		for (var i = 0; i < grants.length; ++i)
		{
			var a = grants[i];
			var privilege = a.privilege();
			if (privilege in this.privilegesByID)
			{
				var sa = this.privilegesByID[privilege];
				sa.accessRecords.push(a);
				sa.accessors.push(a);
			}
		}
	
		var docSection = new crv.SectionView(this)
			.classed('cell documentation', true);

		var docDiv = docSection.append('div');
		docDiv.text(this.helpText);
		
		var sectionView = new crv.SectionView(this)
			.datum(this.privileges[0])
			.classed('cell multiple edit', true);
			
		itemCells = sectionView.appendItemList()
			.classed('deletable-items', true);
	
		// Reference the views back to the privileges objects.
		itemCells.each(function(d) { d.itemsDiv = this; });
		
		items = appendItems(itemCells, 
							function(d) { return d.accessors },
							function(d) {
								_this.editButton.style('display', itemCells.selectAll('li').size() ? '' : 'none');
								_this.navContainer.centerTitle();
							});
		
		this.appendUserControls(sectionView, items);
		
		this.editButton.style('display', itemCells.selectAll('li').size() ? '' : 'none');
		this.navContainer.centerTitle();
		
		/* Add one more button for the add Button item. */
		sectionView
			.append('button').classed('btn row-button add-item site-active-text', true)
			.on('click', function(d) {
				_this.addAccessor(sectionView, "New Administrator", d);
			})
			.append('div').text("Add Administrator");
		
	}

	AdministratorPanel.prototype.getPrivileges = function(panel2Div)
	{
		var _this = this;
		for (var j = 0; j < this.privileges.length; ++j)
		{
			var p = this.privileges[j];
			this.privilegesByID[p.name] = p;
		}
		this.loadAccessRecords(panel2Div, this.grantor);
	}
	
	AdministratorPanel.prototype.userGrantsPath = function()
	{
		return 'user user grant';
	}
	
	function AdministratorPanel(user, backButtonText)
	{
		GrantsPanel.call(this, user);
		
		this.createRoot(null, "Administrators", revealPanelLeft);
		this.panelDiv.classed('sharing', true);
		
		this.appendBackButton(backButtonText);
		
		this.navContainer.appendTitle("Administrators");
		
		this.appendEditButton();
		
		this.privileges =  [
			{name: cr.privileges.administer, id: "", accessRecords: [], accessors: []}];
	
		this.getPrivileges(this.mainDiv);
	}
	
	return AdministratorPanel;
})();

