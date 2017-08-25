var Controller = (function() {
	/* The oldInstance is an instance to be replaced. */
	Controller.prototype._oldInstance = null;
	Controller.prototype._newInstance = null;
	
	Controller.prototype.oldInstance = function(newValue)
	{
		if (newValue === undefined)
			return this._oldInstance;
		else
		{
		    if (newValue != this._oldInstance)
		    {
				this._oldInstance = newValue;
			}
			return this;
		}
	}
	
	Controller.prototype.newInstance = function(newValue)
	{
		if (newValue === undefined)
			return this._newInstance;
		else
		{
		    if (newValue != this._newInstance)
		    {
				this._newInstance = newValue;
			}
			return this;
		}
	}
	
	Controller.prototype.setupPrivilege = function()
		{
			console.assert(false); /* Always override */
		}
		
	/* Append all of the data associated with a new instance. */
	Controller.prototype.appendData = function(initialData)
	{
		this.newInstance().appendData(initialData);
	}
	
	Controller.prototype.save = function()
	{
		var _this = this;
	
		if (this.oldInstance())
		{
			var updateData = this.oldInstance().getUpdateData(this.newInstance());
			
			if (Object.keys(updateData).length == 0)
			{
				var r2 = $.Deferred();
				r2.resolve(updateData, {});
				return r2;
			}
							
			var r;
			if (this.oldInstance().id())
			{
				bootstrap_alert.show($('.alert-container'), this.savingMessage, "alert-info");
				r = this.oldInstance().update(updateData, false);
			}
			else
			{
				r = $.Deferred();
				r.resolve(updateData, {});
			}
			return r
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							/* Add any sub elements from the revision to the original. */
							_this.oldInstance().pullElements(_this.newInstance())
									.updateData(changes, newIDs);
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
		}
		else
		{
			/* Test case: add an experience to a path. */
			if (this.parent().id())
				bootstrap_alert.show($('.alert-container'), this.addingMessage, "alert-info");

			var initialData = {'add': uuid.v4()};

			this.appendData(initialData);
			this.newInstance().clientID(initialData.add);
			return this.postAdd(initialData)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							_this.postAddDone(changes, newIDs);
							$(_this.newInstance()).trigger('added.cr');
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
		}
	}
	
	function Controller(source, duplicateForEdit)
	{
		console.assert(source);
		if (typeof(source) == "object")
		{
			this._newInstance = new source.constructor();
			source.duplicateData(this._newInstance, duplicateForEdit);
		}
		else if (typeof(source) == "function")
		{
			this._newInstance = new source();
			this._newInstance.setDefaultValues();
		}
		this.setupPrivilege();
	}
	
	return Controller;
})();

var RootController = (function() {
	RootController.prototype = Object.create(Controller.prototype);
	RootController.prototype.constructor = RootController;
	
	RootController.prototype.setupPrivilege = function()
	{
		this.newInstance().privilege("write");
	}
	
	/** Posts a new instance of this type to the middle tier and returns a promise. */
	RootController.prototype.postAdd = function(initialData)
	{
		console.assert(this.groupKey !== undefined);
		var changes = {};
		changes[this.groupKey] = [initialData];
		return cr.IInstance.updateRoots(changes);
	}
	
	RootController.prototype.postAddDone = function(changes, newIDs)
	{
		this.newInstance().id(newIDs[this.newInstance().clientID()]);
		crp.pushInstance(this.newInstance());
		this.newInstance().updateData(changes[this.groupKey][0], newIDs);
		return this;
	}

	function RootController(source, duplicateForEdit)
	{
		Controller.call(this, source, duplicateForEdit);
	}
	
	return RootController;
})();

var ChildController = (function() {
	ChildController.prototype = Object.create(Controller.prototype);
	ChildController.prototype.constructor = ChildController;
	ChildController.prototype._parent = null;
	
	Controller.prototype.parent = function(newValue)
	{
		if (newValue === undefined)
			return this._parent;
		else
		{
		    if (newValue != this._parent)
		    {
				this._parent = newValue;
			}
			return this;
		}
	}
	
	ChildController.prototype.setupPrivilege = function()
	{
		this.newInstance().privilege(this._parent.privilege());
	}
	
	ChildController.prototype.postAdd = function(initialData)
	{
		console.assert(this.groupKey !== undefined);
		var changes = {};
		changes[this.groupKey] = [initialData];
		if (this.parent().id())
		{
			return this.parent().update(changes, false);
		}
		else
		{
			r2 = $.Deferred();
			r2.resolve(changes, {});
			return r2;
		}
	}
	
	ChildController.prototype.postAddDone = function(changes, newIDs)
	{
		this.parent().childAdded(this.newInstance(), 
			changes[this.groupKey][0], newIDs, this.addEventType);
		return this;
	}

	function ChildController(parent, source, duplicateForEdit)
	{
		/* Ensure that addEventType is defined. */
		console.assert(this.addEventType);
		
		this.parent(parent);
		Controller.call(this, source, duplicateForEdit);
	}
	
	return ChildController;
})();

var AddressController = (function() {
	AddressController.prototype = Object.create(ChildController.prototype);
	AddressController.prototype.constructor = AddressController;
	
	AddressController.prototype.addingMessage = "Adding Address...";
	AddressController.prototype.savingMessage = "Saving Address...";
	AddressController.prototype.groupKey = 'address';
	AddressController.prototype.addEventType = 'addressAdded.cr';

	function AddressController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Address, duplicateForEdit);
	}
	
	return AddressController;
})();

var EngagementController = (function() {
	EngagementController.prototype = Object.create(ChildController.prototype);
	EngagementController.prototype.constructor = EngagementController;
	
	EngagementController.prototype.addingMessage = "Adding Engagement...";
	EngagementController.prototype.savingMessage = "Saving Engagement...";
	EngagementController.prototype.groupKey = 'engagements';
	EngagementController.prototype.addEventType = 'engagementAdded.cr';

	function EngagementController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Engagement, duplicateForEdit);
	}
	
	return EngagementController;
})();

var ExperienceController = (function() {
	ExperienceController.prototype = Object.create(ChildController.prototype);
	ExperienceController.prototype.constructor = ExperienceController;
	
	ExperienceController.prototype.addingMessage = "Adding Experience To Your Pathway...";
	ExperienceController.prototype.savingMessage = "Saving Experience...";
	ExperienceController.prototype.groupKey = 'experiences';
	ExperienceController.prototype.addEventType = 'experienceAdded.cr';
	
	ExperienceController.prototype._domain = null;
	ExperienceController.prototype._stage = null;
	ExperienceController.prototype._title = null;
	
	ExperienceController.prototype.domain = function(newValue)
	{
		if (newValue === undefined)
			return this._domain;
		else
		{
		    if (newValue != this._domain)
		    {
				this._domain = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.stage = function(newValue)
	{
		if (newValue === undefined)
			return this._stage;
		else
		{
		    if (newValue != this._stage)
		    {
				this._stage = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.title = function(newValue)
	{
		if (newValue === undefined)
			return this._title;
		else
		{
		    if (newValue != this._title)
		    {
				this._title = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.organizationName = function()
	{
		return this.newInstance().organizationName();
	}

	ExperienceController.prototype.siteName = function()
	{
		return this.newInstance().siteName();
	}

	ExperienceController.prototype.offeringName = function()
	{
		return this.newInstance().offeringName();
	}

	ExperienceController.prototype.organization = function(newValue)
	{
		var value = this.newInstance().organization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOrganization = function(newValue)
	{
		var value = this.newInstance().customOrganization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.site = function(newValue)
	{
		var value = this.newInstance().site(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customSite = function(newValue)
	{
		var value = this.newInstance().customSite(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.offering = function(newValue)
	{
		var value = this.newInstance().offering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOffering = function(newValue)
	{
		var value = this.newInstance().customOffering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.experienceServices = function(newValue)
	{
		var value = this.newInstance().experienceServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customServices = function(newValue)
	{
		var value = this.newInstance().customServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.start = function(newValue)
	{
		var value = this.newInstance().start(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.end = function(newValue)
	{
		var value = this.newInstance().end(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.timeframe = function(newValue)
	{
		var value = this.newInstance().timeframe(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.clearOrganization = function()
	{
		this.newInstance().organization(null)
						  .site(null)
						  .customOrganization(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.clearSite = function()
	{
		this.newInstance().site(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.organizationPicked = function(d)
	{
		if (this.site() &&
			this.organization() &&
			this.organization().id() != d.id())
		{
			if (this.offering())
			{
				this.clearOffering();
				this.clearSite();
			}
			else
			{
				this.clearSite();
			}
		}
		
		this.newInstance().organization(d)
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.sitePicked = function(d)
	{
		if (this.offering() &&
			this.site() &&
			this.site().id() != d.id())
			this.clearOffering();
			
		this.newInstance().site(d)
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.offeringPicked = function(d)
	{
		console.assert(d.site());
		console.assert(d.organization());
		
		this.newInstance().offering(d)
						  .customOffering(null)
						  .site(d.site())
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.clearOffering = function()
	{
		this.newInstance().offering(null)
						  .customOffering(null);
		return this;
	}
	
	/* Args can either be a cr.Service or a string. */
	ExperienceController.prototype.addService = function(args)
	{
		if (args instanceof cr.Service)
		{
			var i = new cr.ExperienceService();
			i.description(args.description())
			 .parent(this.newInstance())
			 .service(args)
			 .position(this.experienceServices().length
			           ? this.experienceServices()[this.experienceServices().length - 1].position() + 1
			           : 0);
			this.experienceServices().push(i);
			return i;
		}
		else if (typeof(args) == "string")
		{
			var i = new cr.ExperienceCustomService();
			i.description(args)
			 .parent(this.newInstance())
			 .name(args)
			 .position(this.customServices().length
			           ? this.customServices()[this.customServices().length - 1].position() + 1
			           : 0);
			this.customServices().push(i);
			return i;
		}
		else
			throw new Error("Invalid arguments to addService");
	}
	
	ExperienceController.prototype.removeService = function(service)
	{
		cr.removeElement(this.newInstance().experienceServices(), service);
	}
	
	ExperienceController.prototype.removeCustomService = function(service)
	{
		cr.removeElement(this.newInstance().customServices(), service);
	}
	
	ExperienceController.prototype.distinctExperienceServices = function()
	{
	    return this.newInstance().distinctExperienceServices();
	}
	
	ExperienceController.prototype.getServiceByName = function(name)
	{
		for (i = 0; i < this.experienceServices().length; ++i)
		{
			if (this.experienceServices()[i].description() == name)
				return this.experienceServices()[i].service();
		}
		return null;
	}
	
	ExperienceController.prototype.getTagList = function()
	{
		return this.newInstance().getTagList();
	}
	
	ExperienceController.prototype.appendTags = function(container, tagDivs, addFunction)
	{
		tagDivs = tagDivs !== undefined ? tagDivs : container.selectAll('span');
		addFunction = addFunction !== undefined ? addFunction : function(container, instance)
			{
				container.append('span')
					.datum(instance)
					.classed('tag', true)
					.text(instance.description());
			};
			
		var tags = [];
		
		var offering = this.offering;
		if (offering && offering.id())
		{
			names = offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(os) { return os.service(); });
			tags = tags.concat(names);
		}

		tags = tags.concat(this.experienceServices.filter(function(es) 
			{
				var esDescription = es.description();
				return !tags.find(function(d) 
					{ 
						return d.description() === esDescription; 
					})
			})
			.map(function(es) { return es.service(); })
			);
		
		if (this.domain)
			tags.push(this.domain);
		if (this.stage)
			tags.push(this.stage);
			
		tagDivs.filter(function(d) { return d != null && tags.indexOf(d) < 0; } ).remove();
		
		var ds = tagDivs.data();
		for (var i = 0; i < tags.length; ++i)
		{
			if (ds.indexOf(tags[i]) < 0)
			{
				addFunction(container, tags[i]);
			}
		}
	}
	
	ExperienceController.prototype.postAddDone = function(changes, newIDs)
	{
		/* Remove from the experience any experiences that are
			duplicated in the offering services */
		this.newInstance().experienceServices(this.distinctExperienceServices());
		this.newInstance().path(this.parent());
		
		this.parent().experiences().push(this.newInstance());

		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	ExperienceController.prototype.initPreviousDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("{0}-{1}".format(todayDate.getUTCFullYear() - 1, getMonthString(todayDate)));
		this.newInstance().end("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
	}
	
	ExperienceController.prototype.initCurrentDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
		this.newInstance().end("");
	}
	
	ExperienceController.prototype.initGoalDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("");
		this.newInstance().end("");
	}
	
	ExperienceController.prototype.initDateRange = function(phase)
	{
		if (phase === 'Goal')
			this.initGoalDateRange();
		else if (phase === 'Current')
			this.initCurrentDateRange();
		else
		{
			phase = 'Previous';
			this.initPreviousDateRange();
		}
		this.timeframe(phase);
	}
	
	ExperienceController.prototype.service = function(service)
	{
		if (!service)
			throw new Error("service is not specified");
			
		if (service instanceof cr.Service)
		{
			var services = [new cr.ExperienceService()];
			services[0].service(service)
					   .position(0);
			this.newInstance().experienceServices(services);
		}
		else
		{
			var services = [new cr.ExperienceCustomService()];
			services[0].name(service)
					   .position(0);
			this.newInstance().customServices(services);
		}
		return this;
	}
	
	ExperienceController.prototype.createFromSite = function(d, services)
	{
		this.initPreviousDateRange();
		
		this.organization(d.organization())
			.customOrganization(null)
			.site(d)
			.customSite(null);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
	}

	ExperienceController.prototype.createFromOffering = function(d, services)
	{
		if (!d.organization())
			throw new Error("Runtime Error: Organization is not present in offering record.")
		if (!d.site())
			throw new Error("Runtime Error: Site is not present in offering record.")

		this.initPreviousDateRange();
		
		this.offeringPicked(d);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
	}
	
	ExperienceController.prototype.createFromService = function(d)
	{
		this.initPreviousDateRange();
		
		var service = this.addService(d);
	}
	
	ExperienceController.prototype.getOfferingConstraint = function()
	{
		if (this.experienceServices().length > 0 &&
			this.experienceServices()[0])
			return '[service>service={0}]'.format(this.experienceServices()[0].service().id());
		else if (this.domain())
			return '[service>service={0}]'.format(this.domain().id());
		else if (this.stage())
			return '[service>service[stage={0}]]'.format(this.stage());
		else
			return "";
	}
	
	/** Returns True if this controller has a service that overrides the importance of
		the first service directly associated with this controller's new instance.
	 */
	ExperienceController.prototype.hasPrimaryService = function()
	{
		return this.offering() &&
			   this.offering().offeringServices().length > 0;
	}
	
	ExperienceController.prototype.primaryServices = function()
	{
		var offering = this.offering();
		if (offering && offering.id())
		{
			return offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(s) { return s.service(); });
		}
		else
			return [];
	}
	
	ExperienceController.prototype.serviceLinks = function()
	{
		return this.experienceServices();
	}
	
	ExperienceController.prototype.serviceLinkType = function()
	{
		return cr.ExperienceService;
	}
	
	ExperienceController.prototype.customServiceType = function()
	{
		return cr.ExperienceCustomService;
	}
	
	function ExperienceController(path, source, duplicateForEdit)
	{
		console.assert(path instanceof cr.Path);
			
		ChildController.call(this, path, source || cr.Experience, duplicateForEdit);
	}
	
	return ExperienceController;
})();

var OfferingController = (function() {
	OfferingController.prototype = Object.create(ChildController.prototype);
	OfferingController.prototype.constructor = OfferingController;
	
	OfferingController.prototype.addingMessage = "Adding Offering...";
	OfferingController.prototype.savingMessage = "Saving Offering...";
	OfferingController.prototype.groupKey = 'offerings';
	OfferingController.prototype.addEventType = 'offeringAdded.cr';

	/* Args can either be a cr.Service or a string. */
	OfferingController.prototype.addService = function(args)
	{
		if (args instanceof cr.Service)
		{
			var i = new (this.serviceLinkType())();
			i.description(args.description())
			 .parent(this.newInstance())
			 .service(args)
			 .position(this.serviceLinks().length
			           ? this.serviceLinks()[this.serviceLinks().length - 1].position() + 1
			           : 0);
			this.serviceLinks().push(i);
			return i;
		}
		else
			throw new Error("Invalid arguments to addService");
	}
	
	OfferingController.prototype.removeService = function(service)
	{
		cr.removeElement(this.newInstance().offeringServices(), service);
	}
	
	/** Returns True if this controller has a service that overrides the importance of
		the first service directly associated with this controller's new instance.
	 */
	OfferingController.prototype.hasPrimaryService = function()
	{
		return false;
	}
	
	OfferingController.prototype.primaryServices = function()
	{
		return [];
	}
	
	OfferingController.prototype.serviceLinks = function()
	{
		return this.newInstance().offeringServices();
	}
	
	OfferingController.prototype.serviceLinkType = function()
	{
		return cr.OfferingService;
	}
	
	OfferingController.prototype.customServiceType = function()
	{
		return null;
	}
	
	function OfferingController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Offering, duplicateForEdit);
	}
	
	return OfferingController;
})();

var OrganizationController = (function() {
	OrganizationController.prototype = Object.create(RootController.prototype);
	OrganizationController.prototype.constructor = OrganizationController;
	
	OrganizationController.prototype.addingMessage = "Adding Organization...";
	OrganizationController.prototype.savingMessage = "Saving Organization...";
	OrganizationController.prototype.groupKey = 'organizations';
	
	OrganizationController.prototype.webSite = function(newValue)
	{
		var value = this.newInstance().webSite(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.inquiryAccessGroup = function(newValue)
	{
		var value = this.newInstance().inquiryAccessGroup(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.names = function(newValue)
	{
		var value = this.newInstance().names(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.groups = function(newValue)
	{
		var value = this.newInstance().groups(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.sites = function(newValue)
	{
		var value = this.newInstance().sites(newValue);
		return newValue === undefined ? value : this;
	}

	function OrganizationController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.Organization, duplicateForEdit);
	}
	
	return OrganizationController;
})();

var PeriodController = (function() {
	PeriodController.prototype = Object.create(ChildController.prototype);
	PeriodController.prototype.constructor = PeriodController;
	
	PeriodController.prototype.addingMessage = "Adding Period...";
	PeriodController.prototype.savingMessage = "Saving Period...";
	PeriodController.prototype.groupKey = 'periods';
	PeriodController.prototype.addEventType = 'periodAdded.cr';

	function PeriodController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Period, duplicateForEdit);
	}
	
	return PeriodController;
})();

var SessionController = (function() {
	SessionController.prototype = Object.create(ChildController.prototype);
	SessionController.prototype.constructor = SessionController;
	
	SessionController.prototype.addingMessage = "Adding Session...";
	SessionController.prototype.savingMessage = "Saving Session...";
	SessionController.prototype.groupKey = 'sessions';
	SessionController.prototype.addEventType = 'sessionAdded.cr';

	function SessionController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Session, duplicateForEdit);
	}
	
	return SessionController;
})();

var SiteController = (function() {
	SiteController.prototype = Object.create(ChildController.prototype);
	SiteController.prototype.constructor = SiteController;
	
	SiteController.prototype.addingMessage = "Adding Site...";
	SiteController.prototype.savingMessage = "Saving Site...";
	SiteController.prototype.groupKey = 'sites';
	SiteController.prototype.addEventType = 'siteAdded.cr';

	function SiteController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Site, duplicateForEdit);
	}
	
	return SiteController;
})();

var UserController = (function() {
	UserController.prototype = Object.create(RootController.prototype);
	UserController.prototype.constructor = UserController;
	
	UserController.prototype.addingMessage = "Adding User...";
	UserController.prototype.savingMessage = "Saving User...";
	UserController.prototype.groupKey = 'users';
	
	function UserController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.User, duplicateForEdit);
	}
	
	return UserController;
})();

