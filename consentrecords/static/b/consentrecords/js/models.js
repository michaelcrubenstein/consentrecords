var Queue = (function () {

    Queue.prototype.autorun = true;
    Queue.prototype.running = false;
    Queue.prototype.queue = [];

    function Queue(autorun) {
        if (typeof autorun !== "undefined") {
            this.autorun = autorun;
        }
        this.queue = []; //initialize the queue
    };

    Queue.prototype.add = function (callback) {
        var _this = this;
        //add callback to the queue
        this.queue.push(
        	function () {
				var finished = callback();
				if (typeof finished === "undefined" || finished) {
					//  if callback returns `false`, then you have to 
					//  call `next` somewhere in the callback
					_this.dequeue();
				}
        	}
        );

        if (this.autorun && !this.running) {
            // if nothing is running, then start the engines!
            this.dequeue();
        }

        return this; // for chaining fun!
    };

    Queue.prototype.dequeue = function () {
        this.running = false;
        //get the first element off the queue
        var shift = this.queue.shift();
        if (shift) {
            this.running = true;
            shift();
        }
        return shift;
    };

    Queue.prototype.next = Queue.prototype.dequeue;

    return Queue;

})();

var CRP = (function() {
	CRP.prototype.instances = {};	/* keys are ids, values are objects. */
	CRP.prototype.promises = {};	/* keys are paths, values are promises */
	
    function CRP() {
    	this.clear();
    };
    
    CRP.prototype.clear = function() {
    	this.instances = {};
    	this.promises = {};
    };
    
    /* Get an instance that has been loaded, or undefined if it hasn't been loaded. */
    CRP.prototype.getInstance = function(id)
    {
    	if (!id)
    		throw new Error("id is not defined");
    	if (id in this.instances)
    		return this.instances[id];
    	else
    		return undefined;
    }

	CRP.prototype.pushInstance = function(i)
	{
		if (i.id())
		{
			if (!(i.id() in this.instances))
			{
				this.instances[i.id()] = i;
				return i;
			}
			else
			{
				var oldInstance = this.instances[i.id()];
				return oldInstance.mergeData(i);
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	/*
		args has the following fields: path, fields
	 */
	CRP.prototype.promise = function(args)
	{
		if (args.path in this.promises)
			return this.promises[args.path];

		var _this = this;
		
		var promise = cr.getData(args)
			.fail(function(err)
				{
					_this.promises[args.path] = undefined;
					var result = $.Deferred();
					result.reject(err);
					return result.promise();
				});
		this.promises[args.path] = promise;
		return promise;
	}
	
	return CRP;
})();

var crp = new CRP();

var cr = {}

cr.fieldNames = {
    /* These names are associated with fields. */
    accessRecord: 'access record',
    accessRequest: 'access request',
    addObjectRule: 'object add rule',
    argument: 'argument',
    configuration: 'configuration',
    booleans: 'boolean',
    canBeAskedAboutExperience: 'can be asked about experience',
    dataType: 'data type',
    defaultAccess: 'default access',
    descriptorType: 'descriptor type',
    email: 'email',
    enumerator: 'enumerator',
    field: 'field',
    firstName: 'first name',
    group: 'group',
    isFresh: 'is fresh',
    lastName: 'last name',
    maxCapacity: 'max capacity',
    name: 'name',
    notification: 'notification',
    ofKind: 'of kind',
    pickObjectPath: 'pick object path',
    privilege: 'privilege',
    publicAccess: 'public access',
    primaryAdministrator: 'primary administrator',
    specialAccess: 'special access',
    systemAccess: 'system access',	/* A special field auto-generated to indicate whether a user has system access. */
    term: 'term',
    text: 'text',
    user: 'user',
    userID: 'userID',
}

cr.descriptorTypes = {
	byText: "by text",
	byFirstText: "by first text",
	byCount: "by count"
}

cr.privileges = {
	find: "find",
	read: "read",
	write: "write",
	administer: "administer",
	register: "register"
}

cr.objectAddRules = {
	pickOne: "pick one",
	createOne: "create one",
	pickOrCreateOne: "pick or create one",
}

cr.specialAccesses = {
	custom: "custom"
}

cr.maxCapacities = {
	uniqueValue: "unique value",
	multipleValues: "multiple values"
}

cr.dataTypes = {
	objectType: "object"
}

cr.booleans = {
	yes: "yes",
	no: "no"
}

cr.assertArrayType = function(a, type)
{
	for (var i = 0; i < a.length; ++i)
		console.assert(a[i] instanceof type);
}

cr.ModelObject = (function()
{
	ModelObject.prototype.on = function(events, data, handler)
	{
		if (typeof(events) != "string")
			throw new Error("events is not a string");
		if (typeof(data) != "object")
			throw new Error("data is not an object");
		if (typeof(handler) != "function")
			throw new Error("handler is not a function");
		$(this).on(events, data, handler);
	}

	ModelObject.prototype.one = function(events, data, handler)
	{
		if (typeof(events) != "string")
			throw new Error("events is not a string");
		if (typeof(data) != "object")
			throw new Error("data is not an object");
		if (typeof(handler) != "function")
			throw new Error("handler is not a function");
		$(this).one(events, data, handler);
	}

	ModelObject.prototype.off = function(events, handler)
	{
		$(this).off(events, handler);
	}

	ModelObject.prototype.triggerDataChanged = function(changedValue)
	{
		changedValue = changedValue !== undefined ? changedValue : this;
		$(this).trigger("dataChanged.cr", changedValue);
	}
	
	function ModelObject() {
	};
	
	return ModelObject;
})();
	
cr.Cell = (function() 
	{
		Cell.prototype = new cr.ModelObject();
		Cell.prototype.data = [];
		Cell.prototype.field = null;
		Cell.prototype.parent = null;
		
		Cell.prototype.setParent = function (parent)
		{
			if (parent && !(parent instanceof cr.Instance))
				throw new Error("parent argument is not an instance");
				
			if (this.field.descriptorType !== undefined && this.parent)
			{
				this.off("dataChanged.cr valueAdded.cr valueDeleted.cr", this.parent, this.parent._checkDescription);
			}
			this.parent = parent;
			if (this.field.descriptorType !== undefined && parent)
			{
				this.on("dataChanged.cr valueAdded.cr valueDeleted.cr", parent, parent._checkDescription);
			}
		};

		Cell.prototype.setup = function (parent)
		{
			this.setParent(parent);
	
			/* If this is a unique value and there is no value, set up an unspecified one. */
			if (this.data.length == 0 &&
				this.isUnique()) {
				this.pushValue(this.newValue());
			}
		};

		Cell.prototype.isEmpty = function()
		{
			for (var i = 0; i < this.data.length; ++i)
			{
				if (!this.data[i].isEmpty())
					return false;
			}
			return true;
		};
		
		Cell.prototype.isUnique = function()
		{
			return this.field && this.field.capacity === cr.maxCapacities.uniqueValue;
		}

		Cell.prototype.pushValue = function(newValue)
		{
			newValue.cell = this;		
			this.data.push(newValue);
			newValue.on("dataChanged.cr", this, function(eventObject) {
				eventObject.data.triggerDataChanged();
			});
			newValue.on("valueDeleted.cr", this, function(eventObject) {
				$(eventObject.data).trigger("valueDeleted.cr", newValue);
			});
		};
		
		Cell.prototype.addNewValue = function()
		{
			var newValue = this.newValue();
			this.pushValue(newValue);
			$(this).trigger("valueAdded.cr", newValue);
			return newValue;
		};
		
		/* Returns true if the cell's values need to persist through a delete operation. */
		Cell.prototype.hasPersistentValues = function()
		{
			return this.isUnique();
		}

		Cell.prototype.deleteValue = function(oldData)
		{
			function remove(arr, item) {
				var i = arr.indexOf(item);
				if (i >= 0)
					arr.splice(i, 1);
			  }
			if (this.hasPersistentValues())
			{
				oldData.id = null;
				/* oldData.clearValue(); */
			}
			else
			{
				remove(this.data, oldData);
				oldData.cell = undefined;
			}
		};

		/* This method is used to create a new value on the client that has no data. */
		Cell.prototype.newValue = function() {
			throw "newValue must be overwritten by a subclass";
		}
		
		Cell.prototype.replaceValues = function(instances)
		{
			this.data.forEach(function(i)
				{
					i.cell = undefined;
				});
			
			this.data = [];
			var _this = this;
			instances.forEach(function(i)
				{
					_this.pushValue(i);
				});
		}
	
		function Cell(field) {
			this.data = [];
			this.field = field;
		};
		
		return Cell;
	})();
	
cr.StringCell = (function() {
	StringCell.prototype = new cr.Cell();
	
	StringCell.prototype.newValue = function() {
		return new cr.StringValue();
	}
	
	StringCell.prototype.copyValue = function(oldValue) {
		var newValue = new cr.StringValue();
		if (oldValue.id !== null && oldValue.id !== undefined)
			newValue.id = oldValue.id;
		newValue.text = oldValue.text;
		return newValue;
	}
	
	StringCell.prototype.appendData = function(initialData)
	{
		var newData = [];
		$(this.data).each(function()
			{
				if (this.text)
				{
					var newDatum = {text: this.text};
					newData.push(newDatum);
				}
			});
		if (newData.length > 0)
			initialData[this.field.id] = newData;
	}
	
	StringCell.prototype.getAddCommand = function(newValue)
	{
		return {containerUUID: this.parent.getInstanceID(), 
				fieldID: this.field.nameID, 
				text: newValue};
	}
	
	function StringCell(field) {
		cr.Cell.call(this, field);
	}
	
	return StringCell;
})();

cr.TranslationCell = (function() {
	TranslationCell.prototype = new cr.StringCell();
	
	TranslationCell.prototype.newValue = function() {
		return new cr.TranslationValue();
	}
	
	TranslationCell.prototype.copyValue = function(oldValue) {
		var newValue = new cr.TranslationValue();
		if (oldValue.id)
			newValue.id = oldValue.id;
		newValue.text = oldValue.text;
		newValue.languageCode = oldValue.languageCode;
		return newValue;
	}
	
	TranslationCell.prototype.appendData = function(initialData)
	{
		var newData = [];
		$(this.data).each(function()
			{
				if (this.text)
				{
					newData.push({text: this.text, languageCode: this.languageCode});
				}
			});
		if (newData.length > 0)
			initialData[this.field.id] = newData;
	}
	
	TranslationCell.prototype.getAddCommand = function(newValue)
	{
		return {containerUUID: this.parent.getInstanceID(), 
			    fieldID: this.field.nameID, 
			    text: newValue.text, 
			    languageCode: newValue.languageCode};
	}

	function TranslationCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return TranslationCell;
})();
	
cr.NumberCell = (function() {
	NumberCell.prototype = new cr.StringCell();
	
	function NumberCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return NumberCell;
})();
	
cr.EmailCell = (function() {
	EmailCell.prototype = new cr.StringCell();
	
	function EmailCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return EmailCell;
})();
	
cr.UrlCell = (function() {
	UrlCell.prototype = new cr.StringCell();
	
	function UrlCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return UrlCell;
})();
	
cr.TelephoneCell = (function() {
	TelephoneCell.prototype = new cr.StringCell();
	
	function TelephoneCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return TelephoneCell;
})();
	
cr.DatestampCell = (function() {
	DatestampCell.prototype = new cr.StringCell();
	
	function DatestampCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return DatestampCell;
})();
	
cr.DatestampDayOptionalCell = (function() {
	DatestampDayOptionalCell.prototype = new cr.StringCell();
	
	function DatestampDayOptionalCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return DatestampDayOptionalCell;
})();
	
cr.TimeCell = (function() {
	TimeCell.prototype = new cr.StringCell();
	
	function TimeCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return TimeCell;
})();
	
cr.ObjectCell = (function() {
	ObjectCell.prototype = new cr.Cell();
	
	ObjectCell.prototype.newValue = function() {
		return new cr.ObjectValue();
	}
	
	ObjectCell.prototype.copyValue = function(data) {
		var newValue = new cr.ObjectValue();
		newValue.loadData(data);
		newValue.instance(crp.pushInstance(newValue.instance()))
		return newValue;
	}
	
	ObjectCell.prototype.addValue = function(newValue)
	{
		/* Look for an existing item that is empty. If one is found, then change its data. */
		for (var i = 0; i < this.data.length; ++i)
		{
			var oldData = this.data[i];
			if (!oldData.id && oldData.isEmpty()) {
				oldData._completeUpdate(newValue);
				return;
			}
		}
		this.pushValue(newValue);
		$(this).trigger("valueAdded.cr", newValue);
	}

	ObjectCell.prototype.appendData = function(initialData)
	{
		var newData = [];
		if (this.data)
		{
			for (var i = 0; i < this.data.length; ++i)
			{
				var d = this.data[i];
				if (d.getInstanceID())
				{
					/* This case is true if we are picking an object. */
					newData.push({instanceID: d.getInstanceID()});
				}
				else if (d.getCells())
				{
					/* This case is true if we are creating an object */
					var newDatum = {};
					d.getCells().forEach(function(cell)
					{
						cell.appendData(newDatum);
					});
					
					newData.push({cells: newDatum});
				}
				/* Otherwise, it is blank and shouldn't be saved. */
			}
		}
		initialData[this.field.id] = newData;
	}

	ObjectCell.prototype.find = function(value)
	{
		return this.data.find(function(d2)
			{
				return d2.getInstanceID() === value.getInstanceID();
			});
	}
	
	ObjectCell.prototype.getAddCommand = function(newValue)
	{
		/* The description value is used in updateFromChangeData. */
		return {containerUUID: this.parent.getInstanceID(), 
				fieldID: this.field.nameID, 
				instanceID: newValue.getInstanceID(),
				description: newValue.getDescription()};
	}
	
	ObjectCell.prototype.getConfiguration = function()
	{
		return cr.getConfiguration(null, this.field.ofKindID);
	}
		
	function ObjectCell(field) {
		cr.Cell.call(this, field);
	}
	
	return ObjectCell;
})();

cr.Value = (function() {
	Value.prototype = new cr.ModelObject();
	
	Value.prototype.getDescription = function()
	{ 
		throw new Error("getDescription must be overwritten");
	};
	
	Value.prototype.isEmpty = function()
	{
		throw new Error("isEmpty must be overwritten");
	}
	
	Value.prototype.updateFromChangeData = function()
	{
		throw new Error("updateFromChangeData must be overwritten");
	};
	
	Value.prototype.triggerDeleteValue = function()
	{
		/* Delete from the cell first, so that other objects know the cell may be empty. */
		if (this.cell)
		    this.cell.deleteValue(this);
		$(this).trigger("valueDeleted.cr", this);
	}
	
	Value.prototype.deleteValue = function()
	{
		var _this = this;
		if (this.id == null)	/* It was never saved */
		{
			_this.triggerDeleteValue();
			var r = $.Deferred();
			r.resolve(_this);
			return r;
		}
		else
		{
			return $.ajax({
					url: cr.urls.getData + "value/" + this.id + "/",
					type: 'DELETE',
				})
				.then(function()
					{
						_this.triggerDeleteValue();
						return _this;
					},
					cr.thenFail);
		}
	};
	
	Value.prototype.appendDeleteCommand = function(initialData, sourceObjects)
	{
		initialData.push({id: this.id});
		sourceObjects.push(this);
	}
	
	Value.prototype.update = function(newValueID, initialData, done)
	{
		this.id = newValueID;

		this.updateFromChangeData(initialData);

		if (done)
			done();

		this.triggerDataChanged();
	}
			
	function Value() {
		this.id = null; 
		this.cell = null;	/* Initialize the container cell to empty. */
	};
	
	return Value;
})();
	
cr.StringValue = (function() {
	StringValue.prototype = new cr.Value();

	StringValue.prototype.getDescription = function() { return this.text; };
	
	StringValue.prototype.isEmpty = function()
	{
		return this.text === null || this.text === undefined || this.text === "";
	}

	StringValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		if (newValue === "")
			newValue = null;
			
		/* If both are null, then they are equal. */
		if (!newValue && !this.text)
			newValue = this.text;
		
		var command;
		if (newValue != this.text)
		{
			if (this.id)
			{
				if (newValue)
					command = {id: this.id, text: newValue}
				else
					command = {id: this.id}	/* No value, so delete this item. */
			}
			else
			{
				command = this.cell.getAddCommand(newValue);
				command.index = i;
			}
			initialData.push(command);
			sourceObjects.push(this);
		}
	}
	
	StringValue.prototype.updateFromChangeData = function(changeData)
	{
		this.text = changeData.text;
	}

	function StringValue() {
		cr.Value.call(this);
	}
	
	return StringValue;
})();
	
cr.TranslationValue = (function() {
	TranslationValue.prototype = new cr.StringValue();
	
	TranslationValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		if (newValue.text === "")
			newValue.text = null;
			
		/* If both are null, then they are equal. */
		if (!newValue.text && !this.text)
			newValue.text = this.text;
		
		if (newValue.text !== this.text || 
			newValue.languageCode !== this.languageCode)
		{
			var command;
			if (this.id)
			{
				if (newValue.text)
					command = {id: this.id, text: newValue.text, languageCode: newValue.languageCode};
				else
					command = {id: this.id}; /* No value, so delete the command. */
			}
			else
			{
				command = this.cell.getAddCommand(newValue);
				command.index = i;
			}
			initialData.push(command);
			sourceObjects.push(this);
		}
	}

	TranslationValue.prototype.updateFromChangeData = function(changeData)
	{
		this.text = changeData.text;
		this.languageCode = changeData.languageCode;
	}

	function TranslationValue() {
		cr.StringValue.call(this);
		this.text = null;
		this.languageCode = null;
	};
	
	return TranslationValue;
})();

cr.Instance = (function() {
	Instance.prototype = new cr.ModelObject();
	Instance.prototype._instanceID = null;
	Instance.prototype._description = "None";
	Instance.prototype._typeName = null;
	Instance.prototype._privilege = null;
	Instance.prototype._cells = null;
	Instance.prototype._parentID = null;
	
	Instance.prototype.getDescription = function() 
	{ 
		return this._description;
	};
	
	Instance.prototype.setDescription = function(newDescription)
	{
		this._description = newDescription || "None";
		return this;
	}
	
	Instance.prototype.getInstanceID = function()
	{
		return this._instanceID;
	};
	
	Instance.prototype.setInstanceID = function(instanceID)
	{
		this._instanceID = instanceID;
		return this;
	}
	
	Instance.prototype.getTypeName = function()
	{
		return this._typeName;
	}
	
	Instance.prototype.setTypeName = function(typeName)
	{
		this._typeName = typeName;
		return this;
	}
	
	Instance.prototype.getPrivilege = function()
	{
		return this._privilege;
	}
	
	Instance.prototype.setPrivilege = function(privilege)
	{
		this._privilege = privilege;
		return this;
	}
	
	Instance.prototype.getCells = function()
	{
		return this._cells;
	}
	
	/** Returns true if the cells of this instance are loaded. Otherwise, returns false.
	 * If fields are specified, then, in order to return true, each of the instances referenced
	 * in each specified field must also have all of its cells loaded.
	 */
	Instance.prototype.areCellsLoaded = function(fields)
	{
		if (this._cells === null)
			return false;
		
		if (fields)
		{
			for (var i = 0; i < fields.length; ++i)
			{
				var fieldName = fields[i];
				var cell = this.getCell(fieldName);
				if (cell)
				{
					var datum = cell.data.find(function(d) { return d.getInstanceID() && !d.instance()._cells; });
					if (datum)
						return false;
				}
			}
		}
		
		return true;
	}

	Instance.prototype.setCells = function(cells)
	{
		this._cells = cells;
		var _this = this;
		cells.forEach(function(cell) {
			cell.setParent(_this);
		});
		return this;
	}
	
	/** if parentID is undefined, returns the parent of this instance. The parent off
	 * an instance is the instance that, when deleted, will automatically delete this instance.
	 *
	 * If parentID is defined, then set the parentID of this instance and return this so that
	 * subsequent operations can be chained.
	 */
	Instance.prototype.parent = function(parentID)
	{
		if (parentID === undefined)
			return this._parentID && crp.getInstance(this._parentID);
		else
		{
			this._parentID = parentID;
			return this;
		}
	}
	
	Instance.prototype.updateFromChangeData = function(changeData)
	{
		/* Replace the value completely so that its cells are eliminated and will be
			re-accessed from the server. This handles the case where a value has been added. */
		if (!changeData.instanceID)
			throw new Error("instanceID is not specified.");
		this._instanceID = changeData.instanceID;
		this.setDescription(changeData.description);
		this._cells = null;
	}
	
	Instance.prototype.isEmpty = function()
	{
		return !this.getInstanceID() && !this.getCells();
	}

	Instance.prototype.calculateDescription = function()
	{
		if (!this.getCells())
		{
			if (!this.getDescription())
				this.setDescription("None");
		}
		else
		{
			var nameArray = [];
			this.getCells().forEach(function(cell)
			{
				if (cell.field.descriptorType == cr.descriptorTypes.byText)
				{
					var cellNames = cell.data.filter(function (d) { return !d.isEmpty(); })
						.map(function (d) { return d.getDescription(); });
					if (cellNames.length > 0)
						nameArray.push(cellNames.join(separator=' '));
				}
				else if (cell.field.descriptorType == cr.descriptorTypes.byFirstText)
				{
					var cellNames = cell.data.filter(function (d) { return !d.isEmpty(); })
						.map(function (d) { return d.getDescription(); });
					if (cellNames.length > 0)
						nameArray.push(cellNames[0]);
				}
				else if (cell.field.descriptorType == cr.descriptorTypes.byCount)
				{
					nameArray.push(cell.data.length.toString());
				}
			});
			this.setDescription(nameArray.length ? nameArray.join(separator = ' ') : "None");
		}
	}

	Instance.prototype.hasTextDescription = function()
	{
		var cells = this.getCells();
		for (var i = 0; i < cells; ++i)
		{
			var cell = cells[i];
			if ((cell.field.descriptorType == cr.descriptorTypes.byText ||
			     cell.field.descriptorType == cr.descriptorTypes.byFirstText) &&
				cell.data.length > 0)
				return true;
		}
		return false;
	}

	Instance.prototype.getCell = function(name)
	{
		if (!name)
			throw new Error("name argument of getCell unspecified");
			
		if (this.getCells())
			return this.getCells().find(function(cell)
				{
					return cell.field.name == name;
				});
		else
			return undefined;
	}

	Instance.prototype.getDatum = function(name)
	{
		var cell = this.getCell(name);
		return cell && cell.data.length && cell.data[0].text;
	}
		
	Instance.prototype.getValue = function(name)
	{
		var cell = this.getCell(name);
		return cell && cell.data.length && cell.data[0];
	}
	
	Instance.prototype.getNonNullValue = function(name)
	{
		var d = this.getValue(name);
		if (d && d.getInstanceID())
			return d;
		else
			return undefined;
	}
	
	Instance.prototype.importCell = function(oldCell)
	{
		var newCell = cr.createCell(oldCell.field);
		if (oldCell.data)
		{
			$(oldCell.data).each(function()
			{
				var newValue = newCell.copyValue(this);
				newCell.pushValue(newValue);
			});
		}
		newCell.setup(this);
		this.getCells().push(newCell);
		return newCell;
	}

	/** Import all of the cells from oldCells into the cells of this instance.
	 */
	Instance.prototype.importCells = function(cells)
	{
		if (!cells)
			throw new Error("Runtime Error: argument of cells to import is null");
			
		this._cells = [];
		for (var i = 0, len = cells.length; len > 0; ++i, --len)
			this.importCell(cells[i]);
	}

	/* loadData loads the data from the middle tier or another ObjectValue. */
	Instance.prototype.loadData = function(data)
	{
		this.setInstanceID(data._instanceID || data.instanceID || null);
		this._parentID = data._parentID || data.parentID || null;
		this.setDescription(data._description || data.description || null);
		this.setPrivilege(data._privilege || data.privilege || null);
		this.setTypeName(data._typeName || data.typeName || null);
		
		if (data.getCells)
		{
			if (data.getCells())
			{
				this.importCells(data.getCells());
			}
		}	
		else if (data.cells)
		{
			this.importCells(data.cells);
		}
	}

	/* Import the data associated with this object from the middle tier. */
	Instance.prototype.importData = function(data)
	{
		this.importCells(data.cells);
		this.setPrivilege(data.privilege);
		if (data.typeName)
			this.setTypeName(data.typeName);
	}

	Instance.prototype._handleContentsChanged = function(changedValue)
	{
		var oldDescription = this.getDescription();
		this.calculateDescription();
		if (this.getDescription() != oldDescription)
			this.triggerDataChanged(changedValue);
	}
	
	/* this method is attached to a cell when its contents are changed. */
	Instance.prototype._checkDescription = function(eventObject, changedValue)
	{
		eventObject.data._handleContentsChanged(changedValue);
	}
	
	Instance.prototype.promiseParent = function()
	{
		if (this.getPrivilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.getDescription()));
			return result.promise();
		}
		
		var _this = this;
		
		if (!this._parentID)
		{
			var result = $.Deferred();
			result.resolve(null);
			return result.promise();
		}
		if (this.parent())
		{
			var result = $.Deferred();
			result.resolve(this.parent());
			return result.promise();
		}
		
		return cr.getData({ "path" : this.getInstanceID() })
			.done(function(values)
				{
					var result = $.Deferred();
					result.resolve(values[0].instance());
					return result.promise();
				});
	}

	Instance.prototype.promiseCells = function(fields)
	{
		if (this.getPrivilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.getDescription()));
			return result.promise();
		}
		
		var _this = this;
		function fieldsLoaded(fields)
		{
			if (_this.getCells().find(function(cell)
				{
					if (!fields || fields.indexOf(cell.field.name) < 0)
						return false;
					if (cell.data.find(function(d)
						{
							return d.getInstanceID() && !d.areCellsLoaded();
						}))
						return true;
				}))
				return false;
			if (fields && fields.indexOf("parents") >= 0)
			{
				if (!_this.getCells().find(function(cell)
					{
						return cell.field.name == _this.parent().getTypeName();
					}))
					return false;
			}
			return true;
		}
	
		if (this.getCells() && this.areCellsLoaded() && fieldsLoaded(fields))
		{
			var result = $.Deferred();
			result.resolve(this.getCells());
			return result.promise();
		}
		else if (this.getInstanceID())
		{
			var jsonArray = {};
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields.filter(function(s) { return s.indexOf("/") < 0; }));
			return $.getJSON(cr.urls.getData + this.getInstanceID() + "/", jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							if (json.fields)
							{
								json.fields.forEach(function(field)
									{
										crp.pushField(field);
									});
							}
							/* If the data length is 0, then this item can not be read. */
							if (json.data.length > 0)
							{
								_this.importData(json.data[0]);
							}
							else
							{
								_this.importCells([]);
								_this.setPrivilege(null);
							}
							
							r2.resolve(_this.getCells());
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 )
				.then(function(cells)
					{
						if (!fields)
							return;
							
						var subFields = fields.filter(function(s) { return s.indexOf("/") >= 0; });
						if (subFields.length == 0)
							return;
						try
						{
							return $.when.apply(null, subFields.map(
									function(s) {
										var cellName = s.substring(0, s.indexOf("/"));
										var fieldNames = s.substring(s.indexOf("/") + 1).split(",");
										try
										{
											return cr.getCellValues(_this, cellName, fieldNames); 
										}
										catch(err)
										{
											var r3 = $.Deferred();
											r3.reject(err);
											return r3;
										}
									}))
								.then(function()
									{
										var r3 = $.Deferred();
										r3.resolve(cells);
										return r3;
									},
									function(err)
									{
										var r3 = $.Deferred();
										r3.reject(err);
										return r3;
									});
						}
						catch(err)
						{
							var r3 = $.Deferred();
							r3.reject(err);
							return r3;
						}
					}
				);
		}
		else if (this.cell.field.ofKindID)
		{
			var _this = this;
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			return cr.getConfiguration(this, this.getTypeName())
				.done(function(newCells)
					{
						_this.setCells(newCells);
					});
		}
	}
	
	Instance.prototype.promiseCellsFromCache = function(fields)
	{
		var storedI = crp.getInstance(this.getInstanceID());
		if (storedI && storedI.areCellsLoaded(fields))
		{
			if (this !== storedI)
			{
				this.importCells(storedI.getCells());
			}
			var result = $.Deferred();
			result.resolve(this.getCells());
			return result.promise();
		}
		else 
			return this.promiseCells(fields);
	}
	
	function Instance() {
	};
	
	return Instance;

})();
	
cr.ObjectValue = (function() {
	ObjectValue.prototype = new cr.Value();
	ObjectValue.prototype._instance = null;
	ObjectValue.prototype._instanceDataChanged = null;
	
	ObjectValue.prototype.instance = function(instance)
	{
		if (instance === undefined)
			return this._instance;
		else
		{
			if (this._instance)
			{
				this._instance.off("dataChanged.cr", this._instanceDataChanged);
			}
			
			this._instance = instance;
			var _this = this;
			this._instanceDataChanged = function(eventObject, newValue)
			{
				$(eventObject.data).trigger("dataChanged.cr", newValue == this ? eventObject.data : newValue);
			}
			this._instance.on("dataChanged.cr", this, this._instanceDataChanged);
			return this;
		}
	}
	
	ObjectValue.prototype.getDescription = function() 
	{ 
		return this._instance ? this._instance.getDescription() : "None";
	};
	
	ObjectValue.prototype.setDescription = function(description)
	{
		this._instance.setDescription(description);
		return this;
	}
	
	ObjectValue.prototype.getInstanceID = function()
	{
		return this._instance && this._instance.getInstanceID();
	};
	
	ObjectValue.prototype.setInstanceID = function(instanceID)
	{
		this._instance.setInstanceID(instanceID);
		return this;
	}
	
	ObjectValue.prototype.getTypeName = function()
	{
		return this._instance.getTypeName();
	}
	
	ObjectValue.prototype.setTypeName = function(typeName)
	{
		this._instance.setTypeName(typeName);
		return this;
	}
	
	ObjectValue.prototype.getPrivilege = function()
	{
		return this._instance.getPrivilege();
	}
	
	ObjectValue.prototype.setPrivilege = function(privilege)
	{
		this._instance.setPrivilege(privilege);
		return this;
	}
	
	ObjectValue.prototype.getCells = function()
	{
		return this._instance && this._instance.getCells();
	}
	
	ObjectValue.prototype.areCellsLoaded = function(fields)
	{
		return this._instance.areCellsLoaded(fields);
	}

	ObjectValue.prototype.setCells = function(oldCells)
	{
		this._instance.setCells(oldCells);
		return this;
	}
	
	ObjectValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		var newInstanceID = (newValue ? newValue.getInstanceID() : null);
		var newDescription = (newValue ? newValue.getDescription() : null);

		/* If both are null, then they are equal. */
		if (!newInstanceID && !this.getInstanceID())
			return;
		
		var command;
		if (!newInstanceID)
		{
			if (this.getInstanceID())
				this.appendDeleteCommand(initialData, sourceObjects);
		}
		else {
			if (this.getInstanceID() == newInstanceID)
				return;
			if (this.id)
			{
				command = {id: this.id, instanceID: newInstanceID, description: newDescription};
				if (newValue.areCellsLoaded())
				{
					var _this = this;
					sourceObjects.push({target: this, update: function()
						{
							_this.instance(newValue.instance());
						}});
				}
				else
					sourceObjects.push(this);
			}
			else
			{
				command = this.cell.getAddCommand(newValue);
				if (i >= 0)
					command.index = i;
				if (newValue.areCellsLoaded())
				{
					var _this = this;
					sourceObjects.push({target: this, update: function()
						{
							_this.importCells(newValue.getCells());
						}});
				}
				else
					sourceObjects.push(this);
			}
			initialData.push(command);
		}
		
	}

	ObjectValue.prototype.updateFromChangeData = function(changeData)
	{
		if (changeData.instanceID && crp.getInstance(changeData.instanceID))
			this.instance(crp.getInstance(changeData.instanceID));
		else
		{
			var instance = new cr.Instance();
			instance.loadData(changeData);
			this.instance(crp.pushInstance(instance));
		}
	}
	
	ObjectValue.prototype._completeUpdate = function(newValue)
	{
		this.id = newValue.id;
		this.instance(newValue.instance());
		this.triggerDataChanged();
	}

	ObjectValue.prototype.deleteValue = function()
	{
		var _this = this;
		if (this.cell != null &&
			this.getInstanceID() != null &&
			this.instance().parent() == this.cell.parent)
		{
			/* In this case, this is a root object, so we just need to 
				delete the instance. */
			return $.ajax({
					url: cr.urls.getData + this.getInstanceID() + "/",
					type: 'DELETE',
				})
				.then(function()
					{
						_this.triggerDeleteValue();
						return _this;
					},
					cr.thenFail);
		}
		else
			return cr.Value.prototype.deleteValue.call(this);
	};
	
	ObjectValue.prototype.isEmpty = function()
	{
		return !this._instance || this._instance.isEmpty();
	}

	ObjectValue.prototype.calculateDescription = function()
	{
		this._instance.calculateDescription();
	}

	ObjectValue.prototype.hasTextDescription = function()
	{
		return this._instance && this._instance.hasTextDescription();
	}

	ObjectValue.prototype.getCell = function(name)
	{
		return this._instance && this._instance.getCell(name);
	}

	ObjectValue.prototype.getDatum = function(name)
	{
		return this._instance && this._instance.getDatum(name);
	}
		
	ObjectValue.prototype.getValue = function(name)
	{
		return this._instance && this._instance.getValue(name);
	}
	
	ObjectValue.prototype.getNonNullValue = function(name)
	{
		return this._instance && this._instance.getNonNullValue(name);
	}
		
	ObjectValue.prototype.importCell = function(cell)
	{
		this._instance.importCell(cell);
	}

	ObjectValue.prototype.importCells = function(cells)
	{
		if (!this.instance())
			throw new Error("instance has not been instantiated.");
			
		this._instance.importCells(cells);
	}

	/* loadData loads the data from the middle tier or another ObjectValue. */
	ObjectValue.prototype.loadData = function(data)
	{
		if (data.id)
			this.id = data.id;
		
		if (data.instance && data.instance())
		{
			if (this._instance)
				this._instance.off("dataChanged.cr", this._instanceDataChanged);
			this.instance(data.instance());
		}
		else
		{
			if (!this.instance())
				this.instance(new cr.Instance());
			this.instance().loadData(data);
		}
	}

	/* Save a new version of this object.
		This is called when a object is instantiated on the client as an empty object
		and its data is being filled here.
	 */
	ObjectValue.prototype.saveNew = function(initialData, done, fail)
	{
		var containerCell = this.cell;
		var containerUUID = containerCell.parent ? containerCell.parent.getInstanceID() : null;
			
		var _this = this;
		return $.when(cr.createInstance(containerCell.field, containerUUID, initialData))
		        .then(function(newValue)
		        	{
		        		_this._completeUpdate(newValue);
		        	});
	}
	
	/* Import the data associated with this object from the middle tier. */
	ObjectValue.prototype.importData = function(data)
	{
		this._instance.importData(data);
	}

	ObjectValue.prototype.promiseCells = function(fields)
	{
		return this._instance.promiseCells(fields);
	}
	
	ObjectValue.prototype.promiseCellsFromCache = function(fields)
	{
		return this._instance.promiseCellsFromCache(fields);
	}
	
	ObjectValue.prototype.checkConfiguration = function(done, fail)
	{
		if (!fail)
			throw ("fail is not specified");
		if (!done)
			throw ("done is not specified");
		if (!this.cell)
			throw "cell is not specified for this object";
		
		if (this.getCells())
		{
			done(this.getCells());
		}
		else
		{
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			var _this = this;
			this.cell.getConfiguration()
				.then(function(newCells)
					{
						_this.setCells(newCells);
						done(newCells);
					},
					fail);
		}
	}
	
	ObjectValue.prototype.canWrite = function()
	{
		if (this.getInstanceID() === null)
			throw(this.getDescription() + " has not been saved");
			
		return [cr.privileges.write, cr.privileges.administer].indexOf(this.getPrivilege()) >= 0;
	}
	
	function ObjectValue() {
		cr.Value.call(this);
	};
	
	return ObjectValue;
})();

cr.cellFactory = {
	string: cr.StringCell,
	number: cr.NumberCell,
	email: cr.EmailCell,
	url: cr.UrlCell,
	telephone: cr.TelephoneCell,
	translation: cr.TranslationCell, 
	datestamp: cr.DatestampCell, 
	"datestamp (day optional)": cr.DatestampDayOptionalCell,
	time: cr.TimeCell,
	object: cr.ObjectCell
}
	
cr.createCell = function(fieldID) {
	var field;
	if (typeof(fieldID) == "string")
		field = crp.field(fieldID);
	else if ('id' in fieldID)
		field = crp.field(fieldID.id);
	else
		field = null;
		
	if (!field)
		throw new Error("fieldID is not recognized: {0}".format(fieldID));
		
	var f = cr.cellFactory[field.dataType];
	return new f(field);
};
	
cr.urls = {
		getUserID : "/api/getuserid/",
		getData : "/api/",
		updateValues : "/api/updatevalues/",
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignout: '/user/submitsignout/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
		updateUsername: '/user/updateusername/',
		updatePassword: '/user/updatepassword/',
		acceptFollower: '/user/acceptFollower/',
		requestAccess: '/user/requestAccess/',
		resetPassword: '/user/resetpassword/',
		requestExperienceComment: '/user/requestExperienceComment/',
		log: '/monitor/log/',
	};
	
cr.accessToken = null;
cr.refreshToken = null;
cr.tokenType = null;
	
cr.postError = function(jqXHR, textStatus, errorThrown)
	{
		if (jqXHR.status == 504 || textStatus == "timeout")
			return "This operation ran out of time.";
		else if (jqXHR.status == 403)
			return "Your web page is out of date. You may be able to solve this by reloading the web page.";
		else if (jqXHR.status == 0)
			return "The server is not responding. Please try again.";
		else
			return jqXHR.statusText;
	};

cr.postFailed = function(jqXHR, textStatus, errorThrown, failFunction)
	{
		failFunction(new Error(cr.postError(jqXHR, textStatus, errorThrown)));
	};

cr.thenFail = function(jqXHR, textStatus, errorThrown)
	{
		var r2 = $.Deferred();
		r2.reject(new Error(cr.postError(jqXHR, textStatus, errorThrown)));
		return r2;
	};
	
cr.updateObjectValue = function(oldValue, d, i, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		/* oldValue must be an object value */
		var initialData = [];
		var sourceObjects = [];
		oldValue.appendUpdateCommands(i, d, initialData, sourceObjects);
		$.post(cr.urls.updateValues, 
				{ commands: JSON.stringify(initialData)
				})
			  .done(function(json, textStatus, jqXHR)
				{
					oldValue.id = json.valueIDs[0];
					oldValue.instance(d.instance());
					oldValue.triggerDataChanged();
					successFunction();
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	};
	
cr.deleteValue = function(valueID, successFunction, failFunction)
	{
		return $.ajax({
				url: cr.urls.getData + "value/" + valueID + "/",
				type: 'DELETE',
			})
			.then(undefined,
			cr.thenFail);
	};
			
cr.createInstance = function(field, containerUUID, initialData)
	{
		var jsonArray = {
					properties: JSON.stringify(initialData)
				};
		if (field.nameID)
			jsonArray.elementUUID = field.nameID;
		else if (field.name)
			jsonArray.elementName = field.name;
		else
			throw ("neither field name nor field name ID is specified");
			
		if (field.ofKindID)
			jsonArray.typeID = field.ofKindID;
		else if (field.ofKind)
			jsonArray.typeName = field.ofKind;
		else
			throw ("neither field.ofKindID nor field.ofKind is specified");
		
		var url;	
		if (containerUUID)
			url = cr.urls.getData + containerUUID + "/";
		else
			url = cr.urls.getData;
	
		return $.post(url, jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							var newValue = cr.ObjectCell.prototype.copyValue(json.object);							
							r2.resolve(newValue);
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 );
	},
	
cr.updateValues = function(initialData, sourceObjects)
	{
		return $.post(cr.urls.updateValues, 
			{ commands: JSON.stringify(initialData)
			})
			.then(function(json)
				{
					var r2 = $.Deferred();
					try
					{
						for (var i = 0; i < sourceObjects.length; ++i)
						{
							var d;
							var update;
							if (sourceObjects[i].hasOwnProperty("target"))
							{
								d = sourceObjects[i].target;
								update = sourceObjects[i].update;
							}
							else
							{
								d = sourceObjects[i];
								update = null;
							}
							var newValueID = json.valueIDs[i];
							var newInstanceID = json.instanceIDs[i];

							/* Check to see if d is a cell instead of a value. If so, then
								change it to a newly created value. 
							 */
							if ("addNewValue" in d)
							{
								d = d.addNewValue();
							}
					
							if (newValueID)
							{
								/* Object Values have an instance ID as well. */
								if (newInstanceID)
									initialData[i].instanceID = newInstanceID;
							
								d.update(newValueID, initialData[i], update);
							}
							else
							{
								d.triggerDeleteValue();
							}
						}
						r2.resolve();
					}
					catch (err)
					{
						r2.reject(err);
					}
					return r2;
				},
				cr.thenFail);
	},
	
cr.getUserID = function(successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getUserID,
			{"access_token": cr.accessToken})
		.done(function(json)
			{
				successFunction(json.userID);
			})
		.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			}
		);
	},

cr.getFieldData = function(field)
{
	var nameValue = field.getValue(cr.fieldNames.name);
	var dataTypeValue = field.getValue(cr.fieldNames.dataType);
	var fieldData = {};
	
	fieldData.id = field.getInstanceID();
	fieldData.name = nameValue.getDescription();
	fieldData.nameID = nameValue.getInstanceID();
	fieldData.dataType = dataTypeValue.getDescription();
	fieldData.dataTypeID = dataTypeValue.getInstanceID();
	
	var maxCapacity = field.getValue(cr.fieldNames.maxCapacity);
	fieldData.capacity = maxCapacity ? maxCapacity.getDescription() : cr.maxCapacities.multipleValues;
	
	var descriptorTypeField = field.getValue(cr.fieldNames.descriptorType);
	if (descriptorTypeField)
		fieldData.descriptorType = descriptorTypeField.getDescription();
	
	var addObjectRuleField = field.getValue(cr.fieldNames.addObjectRule);
	if (addObjectRuleField)
		fieldData.objectAddRule = addObjectRuleField.getDescription();
	
	if (fieldData.dataType == cr.dataTypes.objectType)
	{
		var ofKindField = field.getValue(cr.fieldNames.ofKind);
		if (ofKindField)
		{
			fieldData.ofKind = ofKindField.getDescription();
			fieldData.ofKindID = ofKindField.getInstanceID();
		}
		
		var pickObjectPath = field.getDatum(cr.fieldNames.pickObjectPath);
		if (pickObjectPath)
			fieldData.pickObjectPath = pickObjectPath;
	}
	
	return fieldData;
}

cr.getConfiguration = function(parent, typeID)
	{
		var data;
		var path;
		
		if (/^[A-Za-z0-9]{32}$/.test(typeID))
			path = typeID+'/configuration';
		else
			path = 'term[name={0}]/configuration'.format(typeID);
		return crp.promise({path:path, fields: ['field']})
			.then(function(configurations)
				{
					var configuration = configurations[0];
					var cells = [];
					configuration.getCell(cr.fieldNames.field).data.forEach(function(field)
					{
						crp.pushField(cr.getFieldData(field));
						var newCell = cr.createCell(field.getInstanceID());
						newCell.setup(parent);
						cells.push(newCell);
					});
					var r = $.Deferred();
					r.resolve(cells);
					return r;
				});
	},
	
	
/* 
	args is an object with up to four parameters: path, fields, done, fail
 */
cr.getData = function(args)
	{
		if (!args.path)
			throw new Error("path is not specified to getData");
		if (!args.resultType)
		    throw new Error("resultType is not specified to getData");
		
		var data = {};
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getData + args.path + "/", data)
			.then(function(json)
				{
					try
					{
						return json.data.map(function(d)
							{
								var i = new args.resultType();
								i.setData(d);
								if (i.canCache())
									return crp.pushInstance(i);
								else
									return i;
							});
					}
					catch(err)
					{
						var result = $.Deferred();
						result.reject(err);
						return result;
					}
				},
				cr.thenFail);
	}

/* Loads all of the elements of the specified cell within the specified object.
	If the cellName is the name of an objectCell, fieldNames determines the sub-cells that
	are also loaded at the same time.
 */
cr.getCellValues = function(object, cellName, fieldNames)
	{
		var path = '{0}/{1}'.format(object.getInstanceID(), cellName);
		return cr.getData({path: path, fields: fieldNames})
			.then(function(instances)
				{
					var cell = object.getCell(cellName);
					cell.replaceValues(instances);
				},
				function(err)
				{
					r3 = $.Deferred();
					r3.reject(err);
					return r3;
				});
	}

cr.submitSignout = function()
	{
		return $.post(cr.urls.submitSignout, { })
			.then(function(json) {
					crp.clear();
					cr.Service.clearPromises();
				},
				cr.thenFail)
			.promise();
	}

cr.updateUsername = function(newUsername, password)
	{
		return $.post(cr.urls.updateUsername, {newUsername: newUsername, 
										password: password})
		        .then(function(json)
				{
					var v = cr.signedinUser.getValue(cr.fieldNames.email);
					v.updateFromChangeData({text: newUsername});
					v.triggerDataChanged();
				},
				cr.thenFail);
	}
	
cr.updatePassword = function(username, oldPassword, newPassword)
	{
		return $.post(cr.urls.updatePassword, {username: username,
										oldPassword: oldPassword,
										newPassword: newPassword })
				.fail(cr.thenFail);
	}

cr.share = function(userPath, path, resultType, privilegeID, done, fail)
	{
		var url = cr.urls.acceptFollower;
		if (userPath)
			url += userPath + "/";
		$.post(url, {follower: path,
					 privilege: privilegeID
					})
		.done(function(json){
				var newValue = new resultType();
				newValue.setData(json.object);
				done(newValue);
		})
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}

cr.requestAccess = function(follower, followingPath, done, fail)
{
		$.post(cr.urls.requestAccess, {follower: "user/{0}".format(follower.id()),
									   following: followingPath
					  				  })
		.done(done)
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
}

cr.requestExperienceComment = function(experience, followerPath, question)
	{
		var jsonArray = {experience: experience.getInstanceID(),
			path: followerPath.getInstanceID(),
			question: question};
	
		return $.when($.post(cr.urls.requestExperienceComment, jsonArray))
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							json.fields.forEach(function(field)
								{
									crp.pushField(field);
								});
							/* Copy the data from json object into newData so that 
								any functions are properly initialized.
							 */
							var newData;
							if (json.Comments)
							{
								var newComments = cr.ObjectCell.prototype.copyValue(json.Comments);
								var commentsCell = experience.getCell('Comments');
								
								var commentsValue = null;
								for (var i = 0; i < commentsCell.data.length; ++i)
								{
									var oldData = commentsCell.data[i];
									if (!oldData.id && oldData.isEmpty()) {
										if (oldData.instance())
											throw new Error("Assert failed: old comments has instance");
										oldData.id = newComments.id;
										oldData.instance(newComments.instance());
										commentsValue = oldData;
										break;
									}
								}
								if (!commentsValue)
								{
									commentsCell.pushValue(newComments);
									commentsValue = newComments;
								}

								$(commentsValue).trigger('changed.cr', commentsValue);
								newData = commentsValue.getValue('Comment');
							}
							else
							{
								newData = cr.ObjectCell.prototype.copyValue(json.Comment);
								var comments = experience.getValue('Comments');
								commentCell = comments.getCell('Comment');
								commentCell.addValue(newData);
							}
														
							r2.resolve(newData);
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 );
	},
	
cr._logQueue = new Queue(true)
cr.logRecord = function(name, message)
	{
		cr._logQueue.add(function()
		{
			/* This message is silent and does not record errors. */
			message = message !== undefined ? message : 'None';
			$.post(cr.urls.log,
				   {name: name, message: message })
			.done(function() {cr._logQueue.dequeue()});
			return false;
		});
	}

cr.removeElement = function(array, item)
{
	if (array)	/* Ensure the array has been initialized. */
	{
		var n = array.indexOf(item);
		if (n >= 0)
			array.splice(n, 1);
	}
}
	
cr.IInstance = (function() {
	IInstance.prototype = new cr.ModelObject();
	IInstance.prototype._id = null;
	IInstance.prototype._clientID = null;
	IInstance.prototype._description = "None";
	IInstance.prototype._privilege = null;
	IInstance.prototype._parentID = null;
	IInstance.prototype._dataLoaded = false;
	
	IInstance.prototype.id = function(newID)
	{
		if (newID === undefined)
			return this._id;
		else
		{
			this._id = newID;
			return this;
		}
	}
	
	/* The clientID is a temporary id that is used before the item is added.
		The only constraint is that it is unique within a single update operation.
	 */
	IInstance.prototype.clientID = function(newID)
	{
		if (newID === undefined)
			return this._clientID;
		else
		{
			this._clientID = newID;
			return this;
		}
	}
	
	IInstance.prototype.description = function(newDescription)
	{
		if (newDescription === undefined)
			return this._description;
		else
		{
			this._description = newDescription || "None";
			return this;
		}
	}
	
	IInstance.prototype.toString = function()
	{
		return this._description;
	}
	
	IInstance.prototype.privilege = function(newPrivilege)
	{
		if (newPrivilege === undefined)
			return this._privilege;
		else
		{
			this._privilege = newPrivilege;
			return this;
		}
	}
	
	/** if parentID is undefined, returns the parent of this instance. The parent off
	 * an instance is the instance that, when deleted, will automatically delete this instance.
	 *
	 * If parentID is defined, then set the parentID of this instance and return this so that
	 * subsequent operations can be chained.
	 */
	IInstance.prototype.parentID = function(newParentID)
	{
		if (newParentID === undefined)
			return this._parentID && crp.getInstance(this._parentID);
		else
		{
			this._parentID = newParentID;
			return this;
		}
	}
	
    IInstance.prototype.promiseData = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._dataPromise)
        	return this._dataPromise;
        else if (this._dataLoaded)
        {
        	result = $.Deferred();
        	result.resolve(this);
        	return result;
        }
        
        var _this = this;	
        this._dataPromise = this.getData()
        	.done(function()
        		{
        			_this._dataLoaded = true;
        			return _this;
        		});
        return this._dataPromise;
    }
    
	IInstance.prototype.setChildren = function(d, key, childType, children)
	{
		if (key in d)
			children.call(this, 
						  d[key].map(function(d) {
								var i = new childType();
								i.setData(d);
								return i;
							}));
	}

	IInstance.prototype.setData = function(d)
	{
		if ('id' in d)
			this.id(d['id']);
		if ('description' in d)
			this.description(d['description']);
		if ('privilege' in d)
			this.privilege(d['privilege']);
		if ('parentID' in d)
		    this.parentID(d['parentID']);
		return this;
	}
	
	IInstance.prototype.setDefaultValues = function()
	{
		this._description = "";
		this._id = null;
		this._privilege = 'write';
	}
	
	IInstance.prototype.mergeData = function(source)
	{
		// Do nothing.
		if (!this._id) this._id = source._id;
		if (!this._description) this._description = source._description;
		if (!this._privilege) this._privilege = source._privilege;
		if (!this.parentID) this._parentID = source._parentID;
		return this;
	}
	
	/** Returns whether or not this object can be stored in the global
		instance cache.
	 */
	IInstance.prototype.canCache = function()
	{
		return true;
	}
	
	IInstance.prototype.readCheckPromise = function()
	{
		if (this.privilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.description()));
			return result.promise();
		}
		else
		    return undefined;
	}
	
	IInstance.prototype.administerCheckPromise = function()
	{
		if (this.privilege() != cr.privileges.administer)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to administer {0}".format(this.description()));
			return result.promise();
		}
		else
		    return undefined;
	}
	
	IInstance.prototype.canWrite = function()
	{
		if (this.id() === null)
			throw(this.description() + " has not been saved");
			
		return [cr.privileges.write, cr.privileges.administer].indexOf(this.privilege()) >= 0;
	}
	
	/* isEmpty is used to identify temporary instances that are created to fill
		the UI but don't yet have any data. This need may be obsolete.
	 */
	IInstance.prototype.isEmpty = function()
	{
		if (this.id())
		    return false;
		
		return false;
	}
	
	IInstance.prototype.appendUpdateReferenceCommand = function(newValue, f, key, initialData, sourceObjects)
	{
		var onChange = {target: this, update: function() { f(newValue); }};
		if (!newValue)
		{
			if (f())
			{
				initialData[key] = null;
				sourceObjects.push(onChange);
			}
		}
		else if (!f() || f().id() != newValue.id())
		{
			initialData[key] = newValue.id();
			sourceObjects.push(onChange);
		}
	}
	
	IInstance.prototype.appendUpdateValueCommand = function(newValue, f, key, initialData, sourceObjects)
	{
		var onChange = {target: this, update: function() { f(newValue); }};
		if (!newValue)
		{
			if (f())
			{
				initialData[key] = null;
				sourceObjects.push(onChange);
			}
		}
		else if (f() != newValue)
		{
			initialData[key] = newValue;
			sourceObjects.push(onChange);
		}
	}
	
	IInstance.prototype.updateList = function(items, data, newIDs, resultType, addEventType, deletedEventType)
	{
		var _this = this;
		items = items.call(this);
		if (items)
		{
			data.forEach(function(d)
				{
					if ('delete' in d)
					{
						var item = items.find(function(i)
							{
								return i.id() == d['delete'];
							});
						if (item)
						{
							$(item).trigger(deletedEventType, item);
						}
					}
					else if ('add' in d)
					{
						var item = items.find(function(i)
							{
								return i.clientID() == d['add'];
							});
						if (item)
						{
							item.id(newIDs[d['add']])
								.clientID(null);
							$(_this).trigger(addEventType, item);
						}
						else
						{
							$(_this).trigger(addEventType, d);
						}
					}
					else
					{
						var item = items.find(function(i)
							{
								return i.id() == d['id'];
							});
						if (item)
						{
							item.updateData(d, newIDs);
						}
					}
				});
		}
		else
		{
			data.forEach(function(d)
				{
					if ('add' in d)
					{
						$(_this).trigger(addEventType, d);
					}
				});
		}
	}
	
	IInstance.prototype.updateData = function(d, newIDs)
	{
		if ('id' in d)
			this._id = d['id'];
		if ('description' in d)
			this._description = d['description'];
		return false;	/* Changes here do not need to trigger events. */
	}
	
	IInstance.prototype.clear = function()
	{
		this._id = null;
		this._description = null;
		this._parentID = null;
		this._privilege = null;
		return this;
	}

	/* Normally, all of the elements are expected to be part of this, so newIDs are applied
		to existing objects. Otherwise, autoUpdateData should be false, the caller should
		update the data objects as needed and then dall updateData with the changes and newIDs. 
	 */
	IInstance.prototype.update = function(changes, autoUpdateData)
	{
		autoUpdateData = (autoUpdateData !== undefined) ? autoUpdateData : true;
		
		var _this = this;
		if (Object.keys(changes).length == 0)
		{
			var r2 = $.Deferred();
			r2.resolve();
			return r2;
		}
		
		return $.post(cr.urls.updateValues + this.urlPath() + '/', 
			{ commands: JSON.stringify(changes)
			})
			.then(function(json)
				{
					var r2 = $.Deferred();
					try
					{
					    /* If the server succeeds, then update this with the changes and any new IDs. */
						newIDs = json['new IDs'];
					    if (autoUpdateData)
					    	_this.updateData(changes, newIDs);
						r2.resolve(changes, newIDs);
					}
					catch (err)
					{
						r2.reject(err);
					}
					return r2;
				},
				cr.thenFail);
	}
	
	IInstance.prototype.deleteData = function()
	{
		var _this = this;
		return $.ajax({
				url: cr.urls.getData + this.urlPath() + "/",
				type: 'DELETE',
				data: {'languageCode': 'en'},
			})
			.then(function()
				{
					$(_this).trigger("deleted.cr", _this);
					return _this;
				},
				cr.thenFail);
	};
	
	function IInstance() {
	};
	
	return IInstance;

})();

cr.TranslationInstance = (function() {
	TranslationInstance.prototype = new cr.IInstance();
	
	TranslationInstance.prototype._text = null;
	TranslationInstance.prototype._language = null;
	
	TranslationInstance.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	TranslationInstance.prototype.language = function(newValue)
	{
		if (newValue === undefined)
			return this._language;
		else
		{
		    if (newValue != this._language)
		    {
				this._language = newValue;
			}
			return this;
		}
	}
	
	TranslationInstance.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._text = "";
		this._language = null;
	}
	
	TranslationInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._text = 'text' in d ? d['text'] : "";
		this._language = 'languageCode' in d ? d['languageCode'] : "";
	}
	
	TranslationInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.mergeData.call(this, source);
		if (!this._text) this._text = source._text;
		if (!this._language) this._language = source._language;
		return this;
	}
	
	/** For a newly created DateRangeInstance, set its contents to valid values. */
	TranslationInstance.prototype.setDefaultValues = function()
	{
		this._text = "";
		this._language = "en";
	}
	
	/** Called after the contents of the TranslationInstance have been updated on the server. */
	TranslationInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('text' in d)
		{
			this._text = d['text'];
			changed = true;
		}
		if ('languageCode' in d)
		{
			this._language = d['languageCode'];
			changed = true;
		}
		return changed;
	}
	
	function TranslationInstance() {
	    cr.IInstance.call(this);
	};
	
	TranslationInstance.localText = function(list, language)
	{
		if (!list)
			return "";
		
		language = language !== undefined ? language : 'en';
			
        var enName = '';
        var noneName = '';
		for (var i = 0; i < list.length; ++i)
		{
			var t = list[i];
		    if (language == t.language())
		    	return t.text() || '';
		    else if (t.language() == 'en')
		    	enName = t.text();
		    else if (!t.language())
		    	noneName = t.text();
		}
		return noneName || enEname || '';
	}
	
	return TranslationInstance;

})();

cr.ServiceLinkInstance = (function() {
	ServiceLinkInstance.prototype = new cr.IInstance();
	ServiceLinkInstance.prototype._serviceID = null;
	
	ServiceLinkInstance.prototype.setDefaultValues = function()
	{
		this._serviceID = null;
	}
	
	ServiceLinkInstance.prototype.service = function(newValue)
	{
		if (newValue === undefined)
			return this._serviceID && crp.getInstance(this._serviceID);
		else
		{
		    if (newValue.id() != this._serviceID)
		    {
				this._serviceID = newValue.id();
			}
			return this;
		}
	}
	
	/** Sets the data for this ServiceLinkInstance based on a dictionary of data that
		came from the server.
	 */
	ServiceLinkInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._serviceID = ('service' in d) ? d['service']['id'] : null;
	}
	
	ServiceLinkInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._serviceID) this._serviceID = source._serviceID;
		return this;
	}
	
	/** Called after the contents of the ServiceLinkInstance have been updated on the server. */
	ServiceLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('service' in d)
		{
			this._serviceID = d['service']['id'];
			changed = true;
		}
		
		return changed;
	}
	
	function ServiceLinkInstance() {
	    cr.IInstance.call(this);
	};
	
	return ServiceLinkInstance;
})();
	
cr.OrderedServiceLinkInstance = (function() {
	OrderedServiceLinkInstance.prototype = new cr.ServiceLinkInstance();
	OrderedServiceLinkInstance.prototype._position = null;
	
	OrderedServiceLinkInstance.prototype.setDefaultValues = function()
	{
		ServiceLinkInstance.prototype.setDefaultValues.call(this);
		this._position = null;
	}
	
	OrderedServiceLinkInstance.prototype.position = function(newValue)
	{
		if (newValue === undefined)
			return this._position;
		else
		{
		    if (newValue != this._position)
		    {
				this._position = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this OrderedServiceLinkInstance based on a dictionary of data that
		came from the server.
	 */
	OrderedServiceLinkInstance.prototype.setData = function(d)
	{
		cr.ServiceLinkInstance.prototype.setData.call(this, d);
		this._position = d['position'];
	}
	
	OrderedServiceLinkInstance.prototype.mergeData = function(source)
	{
		cr.ServiceLinkInstance.prototype.mergeData.call(this, source);
		if (!this._position) this._position = source._position;
		return this;
	}
	
	/** Called after the contents of the OrderedServiceLinkInstance have been updated on the server. */
	OrderedServiceLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.ServiceLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if ('position' in d)
		{
			this._position = d['position'];
			changed = true;
		}
		
		return changed;
	}
	
	function OrderedServiceLinkInstance() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return OrderedServiceLinkInstance;
})();

cr.UserLinkInstance = (function() {
	UserLinkInstance.prototype = new cr.IInstance();
	UserLinkInstance.prototype._user = null;
	
	UserLinkInstance.prototype.setDefaultValues = function()
	{
		this._user = null;
	}
	
	UserLinkInstance.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
		    if (newValue != this._user)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
	UserLinkInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.pushInstance(this._user);
		}
    }
    
	UserLinkInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._user) this._user = source._user;
		return this;
	}
	
	UserLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		if ('user' in d) {
			var id;
			if (typeof(d['user']) == "object")
				id = d['user']['id'];
			else if (d['user'].startsWith("user/"))
				id = d['user'].substring(5);
			else
				throw new Error("Unrecognized user id: {0}".format(d['user']));
			this._user = crp.getInstance(id);
			
			changed = true;
		}
		
		return changed;
	}

	function UserLinkInstance() {
	    cr.IInstance.call(this);
	};
	
	return UserLinkInstance;
})();
	
cr.Grantable = (function() {
	Grantable.prototype = new cr.IInstance();
	Grantable.prototype._publicAccess = null;
	Grantable.prototype._primaryAdministrator = null;
	Grantable.prototype._userGrants = null;
	Grantable.prototype._groupGrants = null;
	Grantable.prototype._grantsPromise = null;

	Grantable.prototype.userGrants = function(newValue)
	{
		if (newValue === undefined)
			return this._userGrants;
		else
		{
			this._userGrants = newValue;
			return this;
		}
	}
	
	Grantable.prototype.groupGrants = function(newValue)
	{
		if (newValue === undefined)
			return this._groupGrants;
		else
		{
			this._groupGrants = newValue;
			return this;
		}
	}
	
	Grantable.prototype.publicAccess = function(newValue)
	{
		if (newValue === undefined)
			return this._publicAccess;
		else
		{
			if (this._publicAccess != newValue)
			{
				this._publicAccess = newValue;
			}
			return this;
		}
	}
	
	Grantable.prototype.primaryAdministrator = function(newValue)
	{
		if (newValue === undefined)
			return this._primaryAdministrator;
		else
		{
			if (this._primaryAdministrator != newValue)
			{
				this._primaryAdministrator = newValue;
			}
			return this;
		}
	}
	
	Grantable.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._publicAccess = 'public access' in d ? d['public access'] : "";
		if ('primary administrator' in d)
		{
		    this._primaryAdministrator = new cr.User();
		    this._primaryAdministrator.setData(d['primary administrator']);
		    this._primaryAdministrator = crp.getInstance(this._primaryAdministrator);
		}
		if ('user grants' in d)
			this._userGrants = d['user grants'].map(function(d) {
								var i = new cr.UserGrant();
								i.setData(d);
								return i;
							});
		if ('group grants' in d)
			this._groupGrants = d['group grants'].map(function(d) {
								var i = new cr.GroupGrant();
								i.setData(d);
								return i;
							});
    }
    
    /** Merge the contents of the specified source into this Grantable for
    	values that are not specified herein.
     */
	Grantable.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._publicAccess) this._publicAccess = source._publicAccess;
		if (!this._primaryAdministrator) this._primaryAdministrator = source._primaryAdministrator;
		if (!this._userGrants && source._userGrants)
			this._userGrants = source._userGrants;
		if (!this._groupGrants && source._groupGrants)
			this._groupGrants = source._groupGrants;
		return this;
	}
	
	/** Called after the contents of the Grantable have been updated on the server. */
	Grantable.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('public access' in d)
		{
			this._publicAccess = d['public access'];
			changed = true;
		}
		
		if ('primary administrator' in d)
		{
		    this._primaryAdministrator = new cr.User();
		    this._primaryAdministrator.setData(d['primary administrator']);
		    this._primaryAdministrator = crp.getInstance(this._primaryAdministrator);
		    changed = true;
		}
		if ('user grants' in d)
		{
			if (this.updateList(this.userGrants, d['user grants'], newIDs, cr.UserGrant, "userGrantAdded.cr", "userGrantDeleted.cr"))
				changed = true;
		}
		if ('group grants' in d)
		{
			if (this.updateList(this.groupGrants, d['group grants'], newIDs, cr.GroupGrant, "groupGrantAdded.cr", "groupGrantDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
    Grantable.prototype.promiseGrants = function()
    {
    	p = this.administerCheckPromise();
    	if (p) return p;

        if (this._grantsPromise)
        	return this._grantsPromise;
        else if (this.userGrants())
        {
        	result = $.Deferred();
        	result.resolve(this);
        	return result;
        }
        
        var _this = this;	
        this._grantsPromise = cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['user grants', 'group grants'],
        		resultType: cr.User
        	})
        	.done(function(users)
        		{
        			result = $.Deferred();
        			result.resolve(users[0]);
        			return result;
        		});
        return this._grantsPromise;
    }
    
    function Grantable() {
    	cr.IInstance.call(this);
    }
    
    return Grantable;
    
})();

cr.Grant = (function() {
	Grant.prototype = new cr.IInstance();
	Grant.prototype._grantee = null;
	Grant.prototype._privilege = null;
	
	Grant.prototype.grantee = function(newValue)
	{
		if (newValue === undefined)
			return this._grantee;
		else
		{
		    if (newValue.id() != this._grantee.id())
		    {
				this._grantee = newValue;
			}
			return this;
		}
	}
	
	Grant.prototype.privilege = function(newValue)
	{
		if (newValue === undefined)
			return this._privilege;
		else
		{
		    if (newValue != this._privilege)
		    {
				this._privilege = newValue;
			}
			return this;
		}
	}
	
	Grant.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('grantee' in d)
		{
			this._grantee = new (this.granteeType())();
			this._grantee.setData(d['grantee']);
			this._grantee = crp.pushInstance(this._grantee);
		}
		this._privilege = 'privilege' in d ? d['privilege'] : "";
	}
	
	Grant.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._grantee && source.grantee())
			this._grantee = source.grantee();
		if (!this._privilege)
			this._privilege = source.privilege();	
		return this;
	}
	
	/** Returns whether or not this object can be stored in the global
		instance cache.
	 */
	Grant.prototype.canCache = function()
	{
		/* Don't cache these, because they have the same IDs as their grantables. */
		return false;
	}
	
	function Grant() {
	    cr.IInstance.call(this);
	};
	
	return Grant;

})();
	
cr.NamedInstance = (function() {
	NamedInstance.prototype.names = function(newData)
	{
		if (newData === undefined)
			return this._names;
		else
		{
			if (this._names != newData)
				this._names = newData;
			return this;
		}
	}
	
	NamedInstance.prototype.setData = function(d, nameType)
	{
		cr.IInstance.prototype.setChildren.call(this, d, 'names', nameType, NamedInstance.prototype.names);
	}

	function NamedInstance() {};
	return NamedInstance;
})();

cr.WebSiteInstance = (function() {
	WebSiteInstance.prototype.webSite = function(newValue)
	{
		if (newValue === undefined)
			return this._webSite;
		else
		{
		    if (newValue != this._webSite)
		    {
				this._webSite = newValue;
			}
			return this;
		}
	}
	
	function WebSiteInstance() {};
	return WebSiteInstance;
})();

cr.OrganizationLinkInstance = (function() {
	OrganizationLinkInstance.prototype.organization = function(newValue)
	{
		if (newValue === undefined)
			return this._organization;
		else
		{
			if ((this._organization == null) != (newValue == null) ||
			    (newValue && newValue.id != this._organization.id()))
			{
				this._organization = newValue;
			}
			return this;
		}
	}
	
	OrganizationLinkInstance.prototype.setData = function(d)
	{
		if ('organization' in d) {
			this._organization = new cr.Organization();
			this._organization.setData(d['organization']);
			this._organization = crp.pushInstance(this._organization);
		}
		else
			this._organization = null;
	}

	OrganizationLinkInstance.prototype.mergeData = function(source)
	{
		if (!this._organization)
			this._organization = source._organization;
		return this;
	}
	
	OrganizationLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('organization' in d) {
			this._organization = crp.getInstance(d['organization']['id']);
			changed = true;
		}
		
		return changed;
	}

	function OrganizationLinkInstance() {};
	return OrganizationLinkInstance;
})();
	
cr.SiteLinkInstance = (function() {
	SiteLinkInstance.prototype.site = function(newValue)
	{
		if (newValue === undefined)
			return this._site;
		else
		{
			if ((this._site == null) != (newValue == null) ||
			    (newValue && newValue.id != this._site.id()))
			{
				this._site = newValue;
			}
			return this;
		}
	}

	SiteLinkInstance.prototype.setData = function(d)
	{
		if ('site' in d) {
			this._site = new cr.Site();
			this._site.setData(d['site']);
			this._site = crp.pushInstance(this._site);
		}
		else
			this._site = null;
	}

	SiteLinkInstance.prototype.mergeData = function(source)
	{
		if (!this._site)
			this._site = source._site;
		return this;
	}
	
	SiteLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('site' in d) {
			this._site = crp.getInstance(d['site']['id']);
			changed = true;
		}
		
		return changed;
	}

	function SiteLinkInstance() {};
	return SiteLinkInstance;
})();
	
cr.OfferingLinkInstance = (function() {
	OfferingLinkInstance.prototype.offering = function(newValue)
	{
		if (newValue === undefined)
			return this._offering;
		else
		{
			if ((this._offering == null) != (newValue == null) ||
			    (newValue && newValue.id != this._offering.id()))
			{
				this._offering = newValue;
			}
			return this;
		}
	}

	OfferingLinkInstance.prototype.setData = function(d)
	{
		if ('offering' in d) {
			this._offering = new cr.Offering();
			this._offering.setData(d['offering']);
			this._offering = crp.pushInstance(this._offering);
		}
		else
			this._offering = null;
	}

	OfferingLinkInstance.prototype.mergeData = function(source)
	{
		if (!this._offering)
			this._offering = source._offering;
		return this;
	}
	
	OfferingLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('offering' in d) {
			this._offering = crp.getInstance(d['offering']['id']);
			changed = true;
		}
		
		return changed;
	}

	function OfferingLinkInstance() {};
	return OfferingLinkInstance;
})();
	
cr.DateRangeInstance = (function() {
	DateRangeInstance.prototype.start = function(newValue)
	{
		if (newValue === undefined)
			return this._start;
		else
		{
		    if (newValue != this._start)
		    {
				this._start = newValue;
			}
			return this;
		}
	}
	
	DateRangeInstance.prototype.end = function(newValue)
	{
		if (newValue === undefined)
			return this._end;
		else
		{
		    if (newValue != this._end)
		    {
				this._end = newValue;
			}
			return this;
		}
	}
	
	DateRangeInstance.prototype.dateRange = function()
	{
		var startDate = this.start();
		startDate = startDate ? getLocaleDateString(startDate) : "";
		
		var endDate = this.end();
		endDate = endDate ? getLocaleDateString(endDate) : "";
		
		if (startDate || endDate)
			return "{0} - {1}".format(startDate, endDate);
		else
			return "";
	}

	DateRangeInstance.prototype.setData = function(d)
	{
		this._start = 'start' in d ? d['start'] : "";
		this._end = 'end' in d ? d['end'] : "";
	}

	DateRangeInstance.prototype.mergeData = function(source)
	{
		if (!this._start) this._start = source._start;
		if (!this._end) this._end = source._end;
	}
	
	/** For a newly created DateRangeInstance, set its contents to valid values. */
	DateRangeInstance.prototype.setDefaultValues = function()
	{
		this._start = "";
		this._end = "";
	}
	
	DateRangeInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('start' in d)
		{
			this._start = d['start'];
			changed = true;
		}
		if ('end' in d)
		{
			this._end = d['end'];
			changed = true;
		}
		
		return changed;
	}

	function DateRangeInstance() {};
	
	return DateRangeInstance;
})();

cr.Address = (function() {
	Address.prototype = new cr.IInstance();
	Address.prototype._city = null;
	Address.prototype._state = null;
	Address.prototype._zipCode = null;
	Address.prototype._streets = null;
	
	Address.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'address/{0}'.format(this.id());
	}
	
	Address.prototype.city = function(newValue)
	{
		if (newValue === undefined)
			return this._city;
		else
		{
		    if (newValue != this._city)
		    {
				this._city = newValue;
			}
			return this;
		}
	}
	
	Address.prototype.state = function(newValue)
	{
		if (newValue === undefined)
			return this._state;
		else
		{
		    if (newValue != this._state)
		    {
				this._state = newValue;
			}
			return this;
		}
	}
	
	Address.prototype.zipCode = function(newValue)
	{
		if (newValue === undefined)
			return this._zipCode;
		else
		{
		    if (newValue != this._zipCode)
		    {
				this._zipCode = newValue;
			}
			return this;
		}
	}
	
	Address.prototype.streets = function(newValue)
	{
		if (newValue === undefined)
			return this._streets;
		else
		{
		    if (newValue != this._streets)
		    {
				this._streets = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this address based on a dictionary of data that
		came from the server.
	 */
	Address.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._city = 'city' in d ? d['city'] : "";
		this._state = 'state' in d ? d['state'] : "";
		this._zipCode = 'zipCode' in d ? d['zipCode'] : "";
		if ('streets' in d)
			this._streets = d['streets'].map(function(d) {
								var i = new cr.Street();
								i.setData(d);
								return i;
							});
    }
    
    /** Merge the contents of the specified source into this Address for
    	values that are not specified herein.
     */
	Address.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._city) this._city = source._city;
		if (!this._state) this._state = source._state;
		if (!this._zipCode) this._zipCode = source._zipCode;
		if (!this._streets && source._streets)
			this._streets = source._streets.map(function(i)
				{
					j = new cr.Street();
					j.mergeData(i);
					return j;
				});
		return this;
	}
	
	/** For a newly created address, set its contents to valid values. */
	Address.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._city = "";
		this._state = "";
		this._zipCode = "";
		this._streets = [];
	}
	
	/** Called after the contents of the Address have been updated on the server. */
	Address.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('city' in d)
		{
			this._city = d['city'];
			changed = true;
		}
		if ('state' in d)
		{
			this._state = d['state'];
			changed = true;
		}
		if ('zip code' in d)
		{
			this._zipCode = d['zip code'];
			changed = true;
		}
		if ('streets' in d)
		{
			if (this.updateList(this.streets, d['streets'], newIDs, cr.Street, "streetAdded.cr", "streetDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
	function Address() {
	    cr.IInstance.call(this);
	};
	
	return Address;

})();
	
cr.Comment = (function() {
	Comment.prototype = new cr.IInstance();
	Comment.prototype._text = null;
	Comment.prototype._question = null;
	Comment.prototype._asker = null;
	
	Comment.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'comment/{0}'.format(this.id());
	}
	
	Comment.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.appendUpdateTextCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.text, 'text', initialData, sourceObjects);
	}

	Comment.prototype.question = function(newValue)
	{
		if (newValue === undefined)
			return this._question;
		else
		{
		    if (newValue != this._question)
		    {
				this._question = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.appendUpdateQuestionCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.question, 'question', initialData, sourceObjects);
	}

	Comment.prototype.asker = function(newValue)
	{
		if (newValue === undefined)
			return this._asker;
		else
		{
		    if (newValue != this._asker)
		    {
				this._asker = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('asker' in d)
		{
			this._asker = new cr.Path();
			this._asker.setData(d['asker']);
			this._asker = crp.pushInstance(this._asker);
		}
		this._text = 'text' in d ? d['text'] : "";
		this._question = 'question' in d ? d['question'] : "";
    }
    
    Comment.prototype.mergeData = function(source)
    {
    	cr.IInstance.prototype.mergeData.call(this, source);
    	if (!this._user) this._user = source._user;
    	if (!this._text) this._text = source._text;
    	if (!this._question) this._question = source._question;
		return this;
    }
    
	function Comment() {
	    cr.IInstance.call(this);
	};
	
	return Comment;

})();
	
cr.CommentPrompt = (function() {
	CommentPrompt.prototype = new cr.IInstance();
	CommentPrompt.prototype._translations = null;
	
	CommentPrompt.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'comment prompt/{0}'.format(this.id());
	}
	
	CommentPrompt.prototype.translations = function(newValue)
	{
		if (newValue === undefined)
			return this._translations;
		else
		{
		    if (newValue != this._translations)
		    {
				this._translations = newValue;
			}
			return this;
		}
	}
	
	CommentPrompt.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('translations' in d)
			this._translations = d['translations'].map(function(d) {
								var i = new cr.CommentPromptText();
								i.setData(d);
								return i;
							});
    }
    
	CommentPrompt.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._translations = [];
	}
	
	CommentPrompt.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._translations)
			this._translations = source._translations;
		return this;
    }
    
	/** Called after the contents of the CommentPrompt have been updated on the server. */
	CommentPrompt.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('translations' in d)
		{
			if (this.updateList(this.translations, d['translations'], newIDs, cr.CommentPromptText, "translationAdded.cr", "translationDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
	function CommentPrompt() {
	    cr.IInstance.call(this);
	};
	
	return CommentPrompt;

})();
	
cr.CommentPromptText = (function() {
	CommentPromptText.prototype = new cr.TranslationInstance();
	
	CommentPromptText.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'comment prompt translation/{0}'.format(this.id());
	}
	
	function CommentPromptText() {
	    cr.TranslationInstance.call(this);
	};
	
	return CommentPromptText;

})();
	
cr.DisqualifyingTag = (function() {
	DisqualifyingTag.prototype = new cr.ServiceLinkInstance();
	
	DisqualifyingTag.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'disqualifying tag/{0}'.format(this.id());
	}
	
	function DisqualifyingTag() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return DisqualifyingTag;

})();
	
cr.Engagement = (function() {
	Engagement.prototype = new cr.UserLinkInstance();
	Engagement.prototype._user = null;
	Engagement.prototype._start = null;
	Engagement.prototype._end = null;
	Engagement.prototype._organization = null;
	Engagement.prototype._site = null;
	Engagement.prototype._offering = null;
	
	Engagement.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'engagement/{0}'.format(this.id());
	}
	
	Engagement.prototype.start = function(newValue)
	{
		if (newValue === undefined)
			return this._start;
		else
		{
		    if (newValue != this._start)
		    {
				this._start = newValue;
			}
			return this;
		}
	}

	Engagement.prototype.end = function(newValue)
	{
		if (newValue === undefined)
			return this._end;
		else
		{
		    if (newValue != this._end)
		    {
				this._end = newValue;
			}
			return this;
		}
	}
	
	Engagement.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	Engagement.prototype.site = cr.SiteLinkInstance.prototype.site;
	Engagement.prototype.offering = cr.OfferingLinkInstance.prototype.offering;

	Engagement.prototype.setData = function(d)
	{
		cr.UserLinkInstance.prototype.setData.call(this, d);
		this._start = 'start' in d ? d['start'] : "";
		this._end = 'end' in d ? d['end'] : "";
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
		cr.OfferingLinkInstance.prototype.setData.call(this, d);
    }
    
    Engagement.prototype.mergeData = function(source)
    {
		cr.UserLinkInstance.prototype.mergeData.call(this, source);
		cr.DateRangeInstance.prototype.mergeData.call(this, source);
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		cr.OfferingLinkInstance.prototype.mergeData.call(this, source);
		return this;
    }
    
    Engagement.prototype.getData = function()
    {
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['user'],
        		resultType: cr.Engagement
        	});
    }
    
	Engagement.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.UserLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
			
		if ('user' in d)
		{
			this.description(this.user().description());
			$(this).trigger("changed.cr", this);
		}

		if (cr.DateRangeInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		
		return changed;
	}

	function Engagement() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Engagement;

})();
	
cr.Enrollment = (function() {
	Enrollment.prototype = new cr.UserLinkInstance();
	Enrollment.prototype._session = null;
	
	Enrollment.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'enrollment/{0}'.format(this.id());
	}
	
	Enrollment.prototype.session = function(newValue)
	{
		if (newValue === undefined)
			return this._session;
		else
		{
		    if (newValue != this._session)
		    {
				this._session = newValue;
			}
			return this;
		}
	}
	
    Enrollment.prototype.getData = function()
    {
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['user'],
        		resultType: cr.Enrollment
        	});
    }
    
	function Enrollment() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Enrollment;

})();
	
cr.Experience = (function() {
	Experience.prototype = new cr.IInstance();
	Experience.prototype._path = null;
	Experience.prototype._organization = null;
	Experience.prototype._customOrganization = null;
	Experience.prototype._site = null;
	Experience.prototype._customSite = null;
	Experience.prototype._offering = null;
	Experience.prototype._customOffering = null;
	Experience.prototype._start = null;
	Experience.prototype._end = null;
	Experience.prototype._timeframe = null;
	Experience.prototype._services = null;
	Experience.prototype._customServices = null;
	Experience.prototype._comments = null;
	Experience.prototype._commentsPromise = null;
	
	Experience.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience/{0}'.format(this.id());
	}
	
	Experience.prototype.path = function(newValue)
	{
		if (newValue === undefined)
			return this._path;
		else
		{
		    if (newValue != this._path)
		    {
				this._path = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	Experience.prototype.site = cr.SiteLinkInstance.prototype.site;
	Experience.prototype.offering = cr.OfferingLinkInstance.prototype.offering;
	
	Experience.prototype.appendUpdateOrganizationCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateReferenceCommand(newValue, 
			this.organization, 'organization', initialData, sourceObjects);
	}

	Experience.prototype.customOrganization = function(newValue)
	{
		if (newValue === undefined)
			return this._customOrganization;
		else
		{
		    if (newValue != this._customOrganization)
		    {
				this._customOrganization = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateCustomOrganizationCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.customOrganization, 'custom organization', initialData, sourceObjects);
	}

	Experience.prototype.appendUpdateSiteCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateReferenceCommand(newValue, 
			this.site, 'site', initialData, sourceObjects);
	}

	Experience.prototype.customSite = function(newValue)
	{
		if (newValue === undefined)
			return this._customSite;
		else
		{
		    if (newValue != this._customSite)
		    {
				this._customSite = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateCustomSiteCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.customSite, 'custom site', initialData, sourceObjects);
	}

	Experience.prototype.appendUpdateOfferingCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateReferenceCommand(newValue, 
			this.offering, 'offering', initialData, sourceObjects);
	}

	Experience.prototype.customOffering = function(newValue)
	{
		if (newValue === undefined)
			return this._customOffering;
		else
		{
		    if (newValue != this._customOffering)
		    {
				this._customOffering = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateCustomOfferingCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.customOffering, 'custom offering', initialData, sourceObjects);
	}

	Experience.prototype.start = cr.DateRangeInstance.prototype.start;
	Experience.prototype.end = cr.DateRangeInstance.prototype.end;
	Experience.prototype.dateRange = cr.DateRangeInstance.prototype.dateRange;
	
	Experience.prototype.appendUpdateStartCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.start, 'start', initialData, sourceObjects);
	}
	
	Experience.prototype.appendUpdateEndCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.end, 'end', initialData, sourceObjects);
	}

	Experience.prototype.timeframe = function(newValue)
	{
		if (newValue === undefined)
			return this._timeframe;
		else
		{
		    if (newValue != this._timeframe)
		    {
				this._timeframe = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateTimeframeCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.timeframe, 'timeframe', initialData, sourceObjects);
	}

	Experience.prototype.experienceServices = function(newValue)
	{
		if (newValue === undefined)
		{
			if (this._services)
				cr.assertArrayType(this._services, cr.ExperienceService);
			return this._services;
		}
		else
		{
		    if (newValue != this._services)
		    {
		    	cr.assertArrayType(newValue, cr.ExperienceService);
				this._services = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.customServices = function(newValue)
	{
		if (newValue === undefined)
			return this._customServices;
		else
		{
		    if (newValue != this._customServices)
		    {
				this._customServices = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.comments = function(newValue)
	{
		if (newValue === undefined)
			return this._comments;
		else
		{
		    if (newValue != this._comments)
		    {
				this._comments = newValue;
			}
			return this;
		}
	}
	
	/* Copies all of the data associated with this experience except the comments.
	 */
	Experience.prototype.duplicateData = function(newExperience)
	{
		newExperience._path = this._path;
		newExperience._organization = this._organization;
		newExperience._customOrganization = this._customOrganization
		newExperience._site = this._site;
		newExperience._customSite = this._customSite;
		newExperience._offering = this._offering;
		newExperience._customOffering = this._customOffering;
		newExperience._start = this._start;
		newExperience._end = this._end;
		newExperience._timeframe = this._timeframe;
		newExperience._services = this._services.map(function(i)
			{
				target = new cr.ExperienceService();
				target.mergeData(i);
				return target;
			});
		newExperience._customServices = this._customServices.map(function(i)
			{
				target = new cr.ExperienceCustomService();
				target.mergeData(i);
				return target;
			});
		return this;
	}
	
	Experience.prototype.promiseCopy = function(newExperience)
	{
		var _this = this;
		return this.promiseComments()
			.then(function()
				{
					_this.duplicateData(newExperience);
					newExperience._comments = this._comments.map(function(i)
						{
							target = new cr.Comment();
							target.mergeData(i);
							return target;
						});
						
					r = $.Deferred();
					r.resolve(newExperience);
					return r;
				});
	}
	
	Experience.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._organization = null;
		this._customOrganization = "";
		this._site = null;
		this._customSite = "";
		this._offering = null;
		this._customOffering = "";
		this._start = "";
		this._end = "";
		this._timeframe = "Previous";
		this._services = [];
		this._customServices = [];
		this._comments = [];
	}
	
	Experience.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
		cr.OfferingLinkInstance.prototype.setData.call(this, d);
		cr.DateRangeInstance.prototype.setData.call(this, d);
		this._customOrganization = 'custom organization' in d ? d['custom organization'] : "";
		this._customSite = 'custom site' in d ? d['custom site'] : "";
		this._customOffering = 'custom offering' in d ? d['custom offering'] : "";
		this._timeframe = 'timeframe' in d ? d['timeframe'] : "";
		if ('services' in d)
			this._services = d['services'].map(function(d) {
								var i = new cr.ExperienceService();
								i.setData(d);
								return i;
							});
		if ('custom services' in d)
			this._customServices = d['custom services'].map(function(d) {
								var i = new cr.ExperienceCustomService();
								i.setData(d);
								return i;
							});
		if ('comments' in d)
			this._comments = d['comments'].map(function(d) {
								var i = new cr.Comment();
								i.setData(d);
								return i;
							});
    }
    
    /** Merge the contents of the specified source into this Experience for
    	values that are not specified herein.
     */
	Experience.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		cr.OfferingLinkInstance.prototype.mergeData.call(this, source);
		cr.DateRangeInstance.prototype.mergeData.call(this, source);
		if (!this._customOrganization) this._customOrganization = source._customOrganization;
		if (!this._customSite) this._customSite = source._customSite;
		if (!this._customOffering) this._customOffering = source._customOffering;
		if (!this._timeframe) this._timeframe = source._timeframe;
		if (!this._services) this._services = source._services;
		if (!this._customServices) this._customServices = source._customServices;
		if (!this._comments) this._comments = source._comments;
		return this;
	}
	
	/** Called after the contents of the ExperiencePrompt have been updated on the server. */
	Experience.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (cr.OrganizationLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (cr.SiteLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (cr.OfferingLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (cr.DateRangeInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if ('custom organization' in d)
		{
			this._customOrganization = d['custom organization'];
			changed = true;
		}
		if ('custom site' in d)
		{
			this._customSite = d['custom site'];
			changed = true;
		}
		if ('custom offering' in d)
		{
			this._customOffering = d['custom offering'];
			changed = true;
		}
		if ('timeframe' in d)
		{
			this._timeframe = d['timeframe'];
			changed = true;
		}
		if ('translations' in d)
		{
			if (this.updateList(this.translations, d['translations'], newIDs, cr.ExperiencePromptText, "translationAdded.cr", "translationDeleted.cr"))
				changed = true;
		}
		if ('services' in d)
		{
			if (this.updateList(this.experienceServices, d['services'], newIDs, cr.ExperienceService, "experienceServiceAdded.cr", "experienceServiceDeleted.cr"))
				changed = true;
		}
		if ('custom services' in d)
		{
			if (this.updateList(this.customServices, d['custom services'], newIDs, cr.ExperienceCustomService, "customServiceAdded.cr", "customServiceDeleted.cr"))
				changed = true;
		}
		if ('comments' in d)
		{
			if (this.updateList(this.comments, d['comments'], newIDs, cr.Comment, "commentAdded.cr", "commentDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
	Experience.prototype.calculateDescription = function(language)
	{
// 		if (!this.getCells())
// 		{
// 			if (!this.description())
// 				this.description("None");
// 		}
// 		else
		{
			if (this._offering)
				this.description(this._offering.description());
			else if (this._customOffering)
			    this.description(this._customOffering);
			else
			    this.description('Unnamed Offering');
		}
	}
	
	Experience.prototype.promiseOffering = function()
	{
		// No longer needed?
		offering = experience._offering;
		if (offering && offering.id() && !offering.names)
		{
			var storedI = crp.getInstance(offering.id());
			if (storedI && storedI.getCells())
			{
				offering.importCells(storedI.getCells());
				r = $.Deferred();
				r.resolve();
				return r;
			}
			else
			{
				return offering.promiseCells();
			}
		}
		else
		{
			r = $.Deferred();
			r.resolve();
			return r;
		}
	}
	
    Experience.prototype.promiseComments = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._commentsPromise)
        	return this._commentsPromise;
        else if (this._comments)
        {
        	result = $.Deferred();
        	result.resolve(this._comments);
        	return result;
        }
        
        var _this = this;	
        this._commentsPromise = cr.getData(
        	{
        		path: 'experience/{0}/comment'.format(this.id()),
        		fields: [],
        		resultType: cr.Comment
        	})
        	.done(function(comments)
        		{
        			_this._comments = comments;
        			result = $.Deferred();
        			result.resolve(comments);
        			return result;
        		});
        return this._commentsPromise;
    }
    
	Experience.prototype.pickedOrCreatedText = function(picked, created)
	{
		if (picked && picked.id())
			return picked.description();
		else
			return created;
	}

	Experience.prototype.getTagList = function()
	{
		var names = [];
	
		var offering = this.offering();
		if (offering && offering.id())
		{
			if (!offering.offeringServices())
				throw new Error("Runtime error: offering services are not loaded");
			
			names = offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); });
		}
	
		var services = this.experienceServices();
		var customServices = this.customServices();

		if (services)
			names = names.concat(services
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); }));
	
		if (customServices)
			names = names.concat(customServices
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); }));
	
		return names.join(", ");
	}

	Experience.prototype.getPhase = function()
	{
		var t = this.timeframe();
		if (t)
			return t;
			
		var todayDate = getUTCTodayDate().toISOString().substr(0, 10);
		if (!this.start() || this.start() > todayDate)
			return 'Goal';
		else if (!this.end() || this.end() > todayDate)
			return 'Current';
		else
			return 'Previous';
	}
	
	Experience.prototype.organizationName = function()
	{
		if (this.organization())
		    return this.organization().description();
		else
		    return this.customOrganization();
	}
	
	Experience.prototype.siteName = function()
	{
		if (this.site())
		    return this.site().description();
		else
		    return this.customSite();
	}
	
	Experience.prototype.offeringName = function()
	{
		if (this.offering())
		    return this.offering().description();
		else
		    return this.customOffering();
	}
	
	function Experience() {
	    cr.IInstance.call(this);
	};
	
	return Experience;

})();
	
cr.ExperienceCustomService = (function() {
	ExperienceCustomService.prototype = new cr.IInstance();
	ExperienceCustomService.prototype._name = null;
	ExperienceCustomService.prototype._position = null;
	
	ExperienceCustomService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience custom service/{0}'.format(this.id());
	}
	
	ExperienceCustomService.prototype.position = function(newValue)
	{
		if (newValue === undefined)
			return this._position;
		else
		{
		    if (newValue != this._position)
		    {
				this._position = newValue.id();
			}
			return this;
		}
	}
	
	ExperienceCustomService.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue.id();
			}
			return this;
		}
	}
	
	ExperienceCustomService.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._name = 'name' in d ? d['name'] : "";
		this._position = 'position' in d ? d['position'] : 0;
    }
    
    ExperienceCustomService.prototype.mergeData = function(source)
    {
    	cr.IInstance.prototype.mergeData.call(this, source);
    	if (!this._name) this._name = source._name;
    	if (this._position === null) this._position = source._position;
		return this;
    }
    
    ExperienceCustomService.prototype.copyData = function(target)
    {
    	cr.IInstance.prototype.copyData.call(this, target);
    	target._name = this._name;
    	target._position = this._position;
    }
    
	function ExperienceCustomService() {
	    cr.IInstance.call(this);
	};
	
	return ExperienceCustomService;

})();
	
cr.ExperienceService = (function() {
	ExperienceService.prototype = new cr.OrderedServiceLinkInstance();
	
	ExperienceService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience service/{0}'.format(this.id());
	}
	
	function ExperienceService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return ExperienceService;

})();
	
cr.ExperiencePrompt = (function() {
	ExperiencePrompt.prototype = new cr.IInstance();
    ExperiencePrompt.prototype._name = null;
    ExperiencePrompt.prototype._organization = null;
    ExperiencePrompt.prototype._site = null;
    ExperiencePrompt.prototype._offering = null;
    ExperiencePrompt.prototype._domain = null;
    ExperiencePrompt.prototype._stage = null;
    ExperiencePrompt.prototype._timeframe = null;
	ExperiencePrompt.prototype._translations = null;
	ExperiencePrompt.prototype._services = null;
	ExperiencePrompt.prototype._disqualifyingTags = null;
	
	ExperiencePrompt.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience prompt/{0}'.format(this.id());
	}
	
	ExperiencePrompt.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
	ExperiencePrompt.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	ExperiencePrompt.prototype.site = cr.SiteLinkInstance.prototype.site;
	ExperiencePrompt.prototype.offering = cr.OfferingLinkInstance.prototype.offering;
	
	ExperiencePrompt.prototype.domain = function(newValue)
	{
		if (newValue === undefined)
		{
			return this._domainID && crp.getInstance(this._domainID);
		}
		else
		{
		    if (newValue.id() != this._domainID)
		    {
				this._domainID = newValue.id();
			}
			return this;
		}
	}
	
	ExperiencePrompt.prototype.stage = function(newValue)
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
	
	ExperiencePrompt.prototype.timeframe = function(newValue)
	{
		if (newValue === undefined)
			return this._timeframe;
		else
		{
		    if (newValue != this._timeframe)
		    {
				this._timeframe = newValue;
			}
			return this;
		}
	}
	
	ExperiencePrompt.prototype.translations = function(newValue)
	{
		if (newValue === undefined)
			return this._translations;
		else
		{
		    if (newValue != this._translations)
		    {
				this._translations = newValue;
			}
			return this;
		}
	}
	
	ExperiencePrompt.prototype.text = function(language)
	{
		return cr.TranslationInstance.localText(this._translations, language);
	}
	
	ExperiencePrompt.prototype.experiencePromptServices = function(newValue)
	{
		if (newValue === undefined)
			return this._services;
		else
		{
		    if (newValue != this._services)
		    {
				this._services = newValue;
			}
			return this;
		}
	}
	
	ExperiencePrompt.prototype.disqualifyingTags = function(newValue)
	{
		if (newValue === undefined)
			return this._disqualifyingTags;
		else
		{
		    if (newValue != this._disqualifyingTags)
		    {
				this._disqualifyingTags = newValue;
			}
			return this;
		}
	}
	
	ExperiencePrompt.prototype.setDefaultValues = function()
	{
		this._name = "";
		this._organization = null;
		this._site = null;
		this._offering = null;
		this._domainID = null;
		this._stage = "";
		this._timeframe = "";
		this._translations = [];
		this._services = [];
		this._disqualifyingTags = [];
	}
	
	/** Sets the data for this ExperiencePrompt based on a dictionary of data that
		came from the server.
	 */
	ExperiencePrompt.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
		cr.OfferingLinkInstance.prototype.setData.call(this, d);
		this._name = ('name' in d) ? d['name'] : "";
		this._domainID = ('domain' in d) ? d['domain']['id'] : null;
		this._stage = ('stage' in d) ? d['stage'] : "";
		this._timeframe = ('timeframe' in d) ? d['timeframe'] : "";
		if ('translations' in d)
			this._translations = d['translations'].map(function(d) {
								var i = new cr.ExperiencePromptText();
								i.setData(d);
								return i;
							});
		if ('services' in d)
			this._services = d['services'].map(function(d) {
								var i = new cr.ExperiencePromptService();
								i.setData(d);
								return i;
							});
		if ('disqualifying tags' in d)
			this._disqualifyingTags = d['disqualifying tags'].map(function(d) {
								var i = new cr.DisqualifyingTag();
								i.setData(d);
								return i;
							});
	}
	
    /** Merge the contents of the specified source into this ExperiencePrompt for
    	values that are not specified herein.
     */
	ExperiencePrompt.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		cr.OfferingLinkInstance.prototype.mergeData.call(this, source);
		if (!this._domainID) this._domainID = source._domainID;
		if (!this._stage) this._stage = source._stage;
		if (!this._timeframe) this._timeframe = source._timeframe;
		if (!this._translations) this._translations = source._translations;
		if (!this._services) this._services = source._services;
		if (!this._disqualifyingTags) this._disqualifyingTags = source._disqualifyingTags;
		return this;
	}
	
	/** Called after the contents of the ExperiencePrompt have been updated on the server. */
	ExperiencePrompt.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (cr.OrganizationLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (cr.SiteLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (cr.OfferingLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if ('domain' in d)
		{
			this._domainID = d['domain']['id'];
			changed = true;
		}
		if ('stage' in d)
		{
			this._stage = d['stage'];
			changed = true;
		}
		if ('timeframe' in d)
		{
			this._timeframe = d['timeframe'];
			changed = true;
		}
		if ('translations' in d)
		{
			if (this.updateList(this.translations, d['translations'], newIDs, cr.ExperiencePromptText, "translationAdded.cr", "translationDeleted.cr"))
				changed = true;
		}
		if ('services' in d)
		{
			if (this.updateList(this.services, d['services'], newIDs, cr.ExperiencePromptService, "serviceAdded.cr", "serviceDeleted.cr"))
				changed = true;
		}
		if ('disqualifyingTags' in d)
		{
			if (this.updateList(this.disqualifyingTags, d['disqualifyingTags'], newIDs, cr.DisqualifyingTag, "disqualifyingTagAdded.cr", "disqualifyingTagDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
	function ExperiencePrompt() {
	    cr.IInstance.call(this);
	};
	
	return ExperiencePrompt;

})();
	
cr.ExperiencePromptService = (function() {
	ExperiencePromptService.prototype = new cr.OrderedServiceLinkInstance();
	
	ExperiencePromptService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience prompt service/{0}'.format(this.id());
	}
	
	function ExperiencePromptService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return ExperiencePromptService;

})();
	
cr.ExperiencePromptText = (function() {
	ExperiencePromptText.prototype = new cr.TranslationInstance();
	
	ExperiencePromptText.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience prompt text/{0}'.format(this.id());
	}
	
	function ExperiencePromptText() {
	    cr.TranslationInstance.call(this);
	};
	
	return ExperiencePromptText;

})();
	
cr.Group = (function() {
	Group.prototype = new cr.IInstance();
	Group.prototype._names = null;
	Group.prototype._members = null;
	
	Group.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group/{0}'.format(this.id());
	}
	
	Group.prototype.names = cr.NamedInstance.prototype.names;
	
	Group.prototype.members = function(newValue)
	{
		if (newValue === undefined)
			return this._members;
		else
		{
		    if (newValue != this._members)
		    {
				this._members = newValue;
			}
			return this;
		}
	}
	
	Group.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.NamedInstance.prototype.setData.call(this, d, cr.GroupName);
		if ('members' in d)
			this._members = d['members'].map(function(d) {
								var i = new cr.GroupMember();
								i.setData(d);
								return i;
							});
    }
    
    /** Merge the contents of the specified source into this Group for
    	values that are not specified herein.
     */
	Group.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._members && source._members)
			this._members = source._members;
		return this;
	}
	
	/** For a newly created Group, set its contents to valid values. */
	Group.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._names = [];
		this._members = [];
	}
	
	/** Called after the contents of the Group have been updated on the server. */
	Group.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('names' in d)
		{
			if (this.updateList(this.names, d['names'], newIDs, cr.GroupName, "nameAdded.cr", "nameDeleted.cr"))
				changed = true;
		}
		if ('members' in d)
		{
			if (this.updateList(this.members, d['members'], newIDs, cr.GroupMember, "memberAdded.cr", "memberDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
	function Group() {
	    cr.IInstance.call(this);
	};
	
	return Group;

})();
	
cr.GroupGrant = (function() {
	GroupGrant.prototype = new cr.Grant();
	
	GroupGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group grant/{0}'.format(this.id());
	}
	
	GroupGrant.prototype.granteeType = function()
	{
		return cr.Group;
	}
	
	function GroupGrant() {
	    cr.Grant.call(this);
	};
	
	return GroupGrant;

})();
	
cr.GroupName = (function() {
	GroupName.prototype = new cr.TranslationInstance();
	
	GroupName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group name/{0}'.format(this.id());
	}
	
	function GroupName() {
	    cr.TranslationInstance.call(this);
	};
	
	return GroupName;

})();
	
cr.GroupMember = (function() {
	GroupMember.prototype = new cr.UserLinkInstance();
	
	GroupMember.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group member/{0}'.format(this.id());
	}
	
	function GroupMember() {
	    cr.UserLinkInstance.call(this);
	};
	
	return GroupMember;

})();
	
cr.Inquiry = (function() {
	Inquiry.prototype = new cr.UserLinkInstance();
	Inquiry.prototype._session = null;
	
	Inquiry.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'inquiry/{0}'.format(this.id());
	}
	
	Inquiry.prototype.session = function(newValue)
	{
		if (newValue === undefined)
			return this._session;
		else
		{
		    if (newValue != this._session)
		    {
				this._session = newValue;
			}
			return this;
		}
	}
	
	function Inquiry() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Inquiry;

})();
	
cr.Notification = (function() {
	Notification.prototype = new cr.IInstance();
	Notification.prototype._name = null;
	Notification.prototype._isFresh = null;
	Notification.prototype._arguments = null;
	
	Notification.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'notification/{0}'.format(this.id());
	}
	
	Notification.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.isFresh = function(newValue)
	{
		if (newValue === undefined)
			return this._isFresh;
		else
		{
		    if (newValue != this._isFresh)
		    {
				this._isFresh = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.appendUpdateIsFreshCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.isFresh, 'is fresh', initialData, sourceObjects);
	}

	/* Use the abbreviation args instead of arguments because "arguments" is 
	   a reserved word in Javascript.
	 */
	Notification.prototype.args = function(newValue)
	{
		if (newValue === undefined)
			return this._arguments;
		else
		{
		    if (newValue != this._arguments)
		    {
				this._arguments = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._name = 'name' in d ? d['name'] : "";
		this._isFresh = 'is fresh' in d ? d['is fresh'] : "";
		var f = this.controller();
		this._arguments = f.parseArguments(d['arguments']);
    }
    
    /** Merge the contents of the specified source into this Notification for
    	values that are not specified herein.
     */
	Notification.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._name) this._name = source._name;
		if (!this._isFresh) this._isFresh = source._isFresh;
		if (!this._arguments)
			this._arguments = source._arguments;
		return this;
	}
	
    Notification.prototype.controller = function()
    {
    	return crn[this._name.split(".")[1]];
    }
    
	function Notification() {
	    cr.IInstance.call(this);
	};
	
	return Notification;

})();
	
cr.NotificationArgument = (function() {
	NotificationArgument.prototype = new cr.IInstance();
	
	function NotificationArgument() {
	    cr.IInstance.call(this);
	};
	
	return NotificationArgument;

})();
	
cr.Offering = (function() {
	Offering.prototype = new cr.IInstance();
	Offering.prototype._names = null;
    Offering.prototype._webSite = null;
    Offering.prototype._minimumAge = null;
    Offering.prototype._maximumAge = null;
    Offering.prototype._minimumGrade = null;
    Offering.prototype._maximumGrade = null;
    Offering.prototype._services = null;
    Offering.prototype._sessions = null;
    Offering.prototype._organization = null;
    Offering.prototype._site = null;
    Offering.prototype._sessionsPromise = null;
	
	Offering.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'offering/{0}'.format(this.id());
	}
	
	Offering.prototype.names = cr.NamedInstance.prototype.names;
	Offering.prototype.webSite = cr.WebSiteInstance.prototype.webSite;
	
	Offering.prototype.minimumAge = function(newValue)
	{
		if (newValue === undefined)
			return this._minimumAge;
		else
		{
		    if (newValue != this._minimumAge)
		    {
				this._minimumAge = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.maximumAge = function(newValue)
	{
		if (newValue === undefined)
			return this._maximumAge;
		else
		{
		    if (newValue != this._maximumAge)
		    {
				this._maximumAge = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.minimumGrade = function(newValue)
	{
		if (newValue === undefined)
			return this._minimumGrade;
		else
		{
		    if (newValue != this._minimumGrade)
		    {
				this._minimumGrade = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.maximumGrade = function(newValue)
	{
		if (newValue === undefined)
			return this._maximumGrade;
		else
		{
		    if (newValue != this._maximumGrade)
		    {
				this._maximumGrade = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.offeringServices = function(newValue)
	{
		if (newValue === undefined)
			return this._services;
		else
		{
		    if (newValue != this._services)
		    {
				this._services = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.sessions = function(newValue)
	{
		if (newValue === undefined)
			return this._sessions;
		else
		{
		    if (newValue != this._sessions)
		    {
				this._sessions = newValue;
			}
			return this;
		}
	}
	
    Offering.prototype.getData = function()
    {
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['names', 'services'],
        		resultType: cr.Offering
        	});
    }
    
	Offering.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.NamedInstance.prototype.setData.call(this, d, cr.OfferingName);

		this._webSite = 'web site' in d ? d['web site'] : "";
		this._minimumAge = 'minimum age' in d ? d['minimum age'] : "";
		this._maximumAge = 'maximum age' in d ? d['maximum age'] : "";
		this._minimumGrade = 'minimum grade' in d ? d['minimum grade'] : "";
		this._maximumGrade = 'maximum grade' in d ? d['maximum grade'] : "";
		if ('services' in d)
			this._services = d['services'].map(function(d) {
								var i = new cr.OfferingService();
								i.setData(d);
								return i;
							});
		if ('sessions' in d)
			this._sessions = d['sessions'].map(function(d) {
								var i = new cr.Session();
								i.setData(d);
								return i;
							});
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
    }
    
    /** Merge the contents of the specified source into this Offering for
    	values that are not specified herein.
     */
	Offering.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._minimumAge) this._minimumAge = source._minimumAge;
		if (!this._maximumAge) this._maximumAge = source._maximumAge;
		if (!this._minimumGrade) this._minimumGrade = source._minimumGrade;
		if (!this._maximumGrade) this._maximumGrade = source._maximumGrade;
		if (!this._services && source._services)
			this._services = source._services;
		if (!this._sessions && source._sessions)
			this._sessions = source._sessions;
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		return this;
	}
	
	/** For a newly created Offering, set its contents to valid values. */
	Offering.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._names = [];
		this._webSite = "";
		this._minimumAge = "";
		this._maximumAge = "";
		this._minimumGrade = "";
		this._maximumGrade = "";
		this._services = [];
		this._sessions = [];
	}
	
	/** Called after the contents of the Offering have been updated on the server. */
	Offering.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('names' in d)
		{
			if (this.updateList(this.names, d['names'], newIDs, cr.OfferingName, "nameAdded.cr", "nameDeleted.cr"))
				changed = true;
		}
		if ('web site' in d)
		{
			this._city = d['web site'];
			changed = true;
		}
		if ('minimum age' in d)
		{
			this._minimumAge = d['minimum age'];
			changed = true;
		}
		if ('maximum age' in d)
		{
			this._maximumAge = d['maximum age'];
			changed = true;
		}
		if ('minimum grade' in d)
		{
			this._minimumGrade = d['minimum grade'];
			changed = true;
		}
		if ('maximum grade' in d)
		{
			this._maximumGrade = d['maximum grade'];
			changed = true;
		}
		if ('services' in d)
		{
			if (this.updateList(this.experienceServices, d['services'], newIDs, cr.ExperienceService, "experienceServiceAdded.cr", "experienceServiceDeleted.cr"))
				changed = true;
		}
		if ('sessions' in d)
		{
			if (this.updateList(this.sessions, d['sessions'], newIDs, cr.Session, "sessionAdded.cr", "sessionDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
	Offering.prototype.ageRange = function()
	{
		var min = this.minimumAge();
		var max = this.maximumAge();
		if (min)
		{
			if (max)
			{
				if (min == max)
					return min;
				else
					return min + " - " + max;
			}
			else
				return min + " or older";
		}
		else if (max)
		{
			return "up to " + max;
		}
		else
			return "";
	}

	Offering.prototype.gradeRange = function()
	{
		var min = this.minimumGrade();
		var max = this.maximumGrade();
		if (min)
		{
			if (max)
			{
				if (min == max)
					return min;
				else
					return min + " - " + max;
			}
			else
				return min + " or beyond";
		}
		else if (max)
		{
			return "up to " + max;
		}
		else
			return "";
	}

    Offering.prototype.promiseSessions = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._sessionsPromise)
        	return this._sessionsPromise;
        else if (this._sessions)
        {
        	result = $.Deferred();
        	result.resolve(this._sessions);
        	return result;
        }
        
        var _this = this;	
        this._sessionsPromise = cr.getData(
        	{
        		path: this.urlPath() + "/session",
        		fields: ['parents'],
        		resultType: cr.Session
        	})
        	.done(function(sessions)
        		{
        			_this._sessions = sessions;
        			result = $.Deferred();
        			result.resolve(sessions);
        			return result;
        		});
        return this._sessionsPromise;
    }
    
	function Offering() {
	    cr.IInstance.call(this);
	};
	
	return Offering;

})();
	
cr.OfferingName = (function() {
	OfferingName.prototype = new cr.TranslationInstance();
	
	OfferingName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'offering name/{0}'.format(this.id());
	}
	
	function OfferingName() {
	    cr.TranslationInstance.call(this);
	};
	
	return OfferingName;

})();
	
cr.OfferingService = (function() {
	OfferingService.prototype = new cr.OrderedServiceLinkInstance();
	
	OfferingService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'offering service/{0}'.format(this.id());
	}
	
	function OfferingService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return OfferingService;

})();
	
cr.Organization = (function() {
	Organization.prototype = new cr.Grantable();
	Organization.prototype._webSite = null;
	Organization.prototype._inquiryAccessGroup = null;
	Organization.prototype._names = null;
	Organization.prototype._groups = null;
	Organization.prototype._sites = null;
	
	Organization.prototype.names = cr.NamedInstance.prototype.names;
	Organization.prototype.webSite = cr.WebSiteInstance.prototype.webSite;
	
	Organization.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'organization/{0}'.format(this.id());
	}
	
	Organization.prototype.inquiryAccessGroup = function(newValue)
	{
		if (newValue === undefined)
			return this._inquiryAccessGroup;
		else
		{
		    if (newValue != this._inquiryAccessGroup)
		    {
				this._inquiryAccessGroup = newValue;
			}
			return this;
		}
	}
	

	Organization.prototype.groups = function(newValue)
	{
		if (newValue === undefined)
			return this._groups;
		else
		{
		    if (newValue != this._groups)
		    {
				this._groups = newValue;
			}
			return this;
		}
	}
	
	Organization.prototype.sites = function(newValue)
	{
		if (newValue === undefined)
			return this._sites;
		else
		{
		    if (newValue != this._sites)
		    {
				this._sites = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this Organization based on a dictionary of data that
		came from the server.
	 */
	Organization.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		cr.NamedInstance.prototype.setData.call(this, d, cr.OrganizationName);

		this._webSite = 'web site' in d ? d['web site'] : "";

		if ('groups' in d)
			this._groups = d['groups'].map(function(d) {
								var i = new cr.Group();
								i.setData(d);
								return crp.pushInstance(i);
							});
		if ('sites' in d)
			this._sites = d['sites'].map(function(d) {
								var i = new cr.Site();
								i.setData(d);
								return crp.pushInstance(i);
							});
		if ('inquiry access group' in d && this._groups)
			this._inquiryAccessGroup = this._groups.find(function(group)
				{
					return group.id() == d['inquiry access group']['id'];
				});
    }
    
    /** Merge the contents of the specified source into this Organization for
    	values that are not specified herein.
     */
	Organization.prototype.mergeData = function(source)
	{
		cr.Grantable.prototype.mergeData.call(this, source);
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._groups && source._groups)
			this._groups = source._groups;
		if (!this._sites && source._sites)
			this._sites = source._sites;
		if (!this._inquiryAccessGroup && source._inquiryAccessGroup && this._groups)
		{
			this._inquiryAccessGroup = this._groups.find(function(group)
				{
					return group.id() == source._inquiryAccessGroup.id();
				});
		}
		return this;
	}
	
	/** For a newly created Organization, set its contents to valid values. */
	Organization.prototype.setDefaultValues = function()
	{
		cr.Grantable.prototype.setDefaultValues.call(this);
		this._webSite = "";
		this._names = [];
		this._groups = [];
		this._sites = [];
		this._inquiryAccessGroup = null;
	}
	
	/** Called after the contents of the Organization have been updated on the server. */
	Organization.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.Grantable.prototype.updateData.call(this, d, newIDs))
			changed = true;
			
		if ('web site' in d)
		{
			this._webSite = d['web site'];
			changed = true;
		}
		if ('names' in d)
		{
			if (this.updateList(this.names, d['names'], newIDs, cr.OrganizationName, "nameAdded.cr", "nameDeleted.cr"))
				changed = true;
		}
		if ('groups' in d)
		{
			if (this.updateList(this.groups, d['groups'], newIDs, cr.Group, "groupAdded.cr", "groupDeleted.cr"))
				changed = true;
		}
		if ('sites' in d)
		{
			if (this.updateList(this.sites, d['sites'], newIDs, cr.Site, "siteAdded.cr", "siteDeleted.cr"))
				changed = true;
		}
		if ('inquiry access group' in d)
		{
			this._inquiryAccessGroup = this.groups().find(function(group)
				{
					return group.id() == d['inquiry access group']['id'];
				});
			changed = true;
		}
		
		return changed;
	}
	
    Organization.prototype.getData = function()
    {
    	var _this = this;
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['sites', 'groups'],
        		resultType: cr.Organization
        	})
        	.then(function()
        	{
        		_this.sites().forEach(function(site)
        			{
        				site.organization(_this);
        			});
        		return _this;
        	});
    }
    
	function Organization() {
	    cr.Grantable.call(this);
	};
	
	return Organization;

})();
	
cr.OrganizationName = (function() {
	OrganizationName.prototype = new cr.TranslationInstance();
	
	OrganizationName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'organization name/{0}'.format(this.id());
	}
	
	function OrganizationName() {
	    cr.TranslationInstance.call(this);
	};
	
	return OrganizationName;

})();
	
cr.Path = (function() {
	Path.prototype = new cr.Grantable();
	Path.prototype._birthday = null;
	Path.prototype._name = null;
	Path.prototype._specialAccess = null;
	Path.prototype._canAnswerExperience = null;
	Path.prototype._experiences = null;
	Path.prototype._experiencesPromise = null;
	Path.prototype._user = null;
	Path.prototype._userPromise = null;
	Path.prototype.someoneString = "Someone";
	
	Path.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'path/{0}'.format(this.id());
	}
	
	Path.prototype.birthday = function(newValue)
	{
		if (newValue === undefined)
			return this._birthday;
		else
		{
		    if (newValue != this._birthday)
		    {
				this._birthday = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
/**
 * Returns a string that describes the user associated with the specified path.
 * The string may be either the name of the user associated with the path (if defined
 * and accessible), the screen name associated with the path, the email address
 * associated with the user associated with the path (if defined and accessible) or
 * "Someone" (or some translation thereof)
 */
	Path.prototype.caption = function()
	{
		return (this.user() && this.user().fullName()) ||
				this.description() ||
			   (this.user() && this.user().description()) ||
				this.someoneString;
	}
	
	Path.prototype.specialAccess = function(newValue)
	{
		if (newValue === undefined)
			return this._specialAccess;
		else
		{
		    if (newValue != this._specialAccess)
		    {
				this._specialAccess = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.canAnswerExperience = function(newValue)
	{
		if (newValue === undefined)
			return this._canAnswerExperience;
		else
		{
		    if (newValue != this._canAnswerExperience)
		    {
				this._canAnswerExperience = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
		    if (newValue != this._user)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
    Path.prototype.promiseUser = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._userPromise)
        	return this._userPromise;
        else if (this._user)
        {
        	result = $.Deferred();
        	result.resolve(this._user);
        	return result;
        }
        else if (this._parentID && crp.getInstance(this._parentID))
        {
        	this._user = crp.getInstance(this._parentID);
        	result = $.Deferred();
        	result.resolve(this._user);
        	return result;
		}
		        
        var _this = this;	
        this._userPromise = cr.getData(
        	{
        		path: 'path/{0}/user'.format(this.id()),
        		fields: [],
        		resultType: cr.User
        	})
        	.done(function(users)
        		{
        			var user = users[0];
        			_this._user = user;
        			user.path(_this);
        			result = $.Deferred();
        			result.resolve(user);
        			return result;
        		});
        return this._userPromise;
    }
    
	Path.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		this._birthday = 'birthday' in d ? d['birthday'] : "";
		this._name = 'name' in d ? d['name'] : "";
		this._specialAccess = 'special access' in d ? d['special access'] : "";
		this._canAnswerExperience = 'can answer experience' in d ? d['can answer experience'] : "";
		var _this = this;
		if ('experiences' in d)
			this._experiences = d['experiences'].map(function(d) {
								var i = new cr.Experience();
								i.setData(d);
								i.path(_this);
								return i;
							});
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.getInstance(this._user);
		}
    }
    
    /** Merge the contents of the specified source into this Path for
    	values that are not specified herein.
     */
	Path.prototype.mergeData = function(source)
	{
		cr.Grantable.prototype.mergeData.call(this, source);
		if (this._name === null) this._name = source._name;
		if (!this._experiences) 
		{
			this._experiences = source._experiences;
			var _this = this;
			if (this._experiences)
				this._experiences.forEach(function(e) { e.path(_this); });
		}
		if (!this._user) this._user = source._user;
		return this;
	}
	
	/** Called after the contents of the Path have been updated on the server. */
	Path.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.Grantable.prototype.updateData.call(this, d, newIDs))
			changed = true;
		
		if ('screen name' in d)
		{
			this._name = d['screen name'];
			this.description(this._name);
			changed = true;
		}
		if ('special access' in d)
		{
			this._specialAccess = d['special access'];
			changed = true;
		}
		if ('can answer experience' in d)
		{
			this._canAnswerExperience = d['can answer experience'];
			changed = true;
		}

		if (changed)
		{
			$(this).trigger("changed.cr", this);
		}
		
		if ('experiences' in d)
		{
			if (this.updateList(this.experiences, d['experiences'], newIDs, cr.Experience, "experienceAdded.cr", "experienceDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
    Path.prototype.experiences = function(newValue)
    {
    	if (newValue === undefined)
    	{
    		if (this._experiences === null)
    			throw new Error("Runtime Error: experiences of a path have not been set");
    		else
    			return this._experiences;
    	}
    	else
    	{
    		this._experiences = newValue;
    	}
    }
    
    Path.prototype.promiseExperiences = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._experiencesPromise)
        	return this._experiencesPromise;
        else if (this._experiences)
        {
        	result = $.Deferred();
        	result.resolve(this._experiences);
        	return result;
        }
        
        var _this = this;	
        this._experiencesPromise = cr.getData(
        	{
        		path: 'path/{0}/experience'.format(this.id()),
        		fields: ['services', 'custom services'],
        		resultType: cr.Experience
        	})
        	.done(function(experiences)
        		{
        			_this._experiences = experiences;
        			_this._experiences.forEach(function(e)
        				{
        					e.path(_this);
        				});
        			result = $.Deferred();
        			result.resolve(experiences);
        			return result;
        		});
        return this._experiencesPromise;
    }
    
	function Path() {
	    cr.Grantable.call(this);
	};
	
	return Path;

})();
	
cr.Period = (function() {
	Period.prototype = new cr.IInstance();
    Period.prototype._weekday = null;
    Period.prototype._startTime = null;
    Period.prototype._endTime = null;
	
	Period.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'period/{0}'.format(this.id());
	}
	
	Period.prototype.weekday = function(newValue)
	{
		if (newValue === undefined)
			return this._weekday;
		else
		{
		    if (newValue != this._weekday)
		    {
				this._weekday = newValue;
			}
			return this;
		}
	}
	
	Period.prototype.startTime = function(newValue)
	{
		if (newValue === undefined)
			return this._startTime;
		else
		{
		    if (newValue != this._startTime)
		    {
				this._startTime = newValue;
			}
			return this;
		}
	}
	
	Period.prototype.endTime = function(newValue)
	{
		if (newValue === undefined)
			return this._endTime;
		else
		{
		    if (newValue != this._endTime)
		    {
				this._endTime = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this Period based on a dictionary of data that
		came from the server.
	 */
	Period.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._weekday = 'weekday' in d ? d['weekday'] : "";
		this._startTime = 'start time' in d ? d['start time'] : "";
		this._endTime = 'end time' in d ? d['end time'] : "";
    }
    
    /** Merge the contents of the specified source into this Period for
    	values that are not specified herein.
     */
	Period.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (this._weekday === null) this._weekday = source._weekday;
		if (!this._startTime) this._startTime = source._startTime;
		if (!this._endTime) this._endTime = source._endTime;
		return this;
	}
	
	/** For a newly created Period, set its contents to valid values. */
	Period.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._weekday = "";
		this._startTime = "";
		this._endTime = "";
	}
	
	Period.prototype.weekdayDescription = function()
	{
		return this._weekday == null ? "any day" :
			Date.CultureInfo.dayNames[parseInt(this._weekday)];
	}
	
	/** Called after the contents of the Period have been updated on the server. */
	Period.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		var changed = false;
		if ('weekday' in d)
		{
			this._weekday = d['weekday'];
			changed = true;
		}
		if ('start time' in d)
		{
			this._startTime = d['start time'];
			changed = true;
		}
		if ('end time' in d)
		{
			this._endTime = d['end time'];
			changed = true;
		}
		if (changed)
		{
			this.description("{0}: {1}-{2}".format(
					this.weekdayDescription(),
					this._startTime,
					this._endTime
				));
			$(this).trigger("changed.cr", this);
		}
		
		return changed;
	}
	
	function Period() {
	    cr.IInstance.call(this);
	};
	
	return Period;

})();
	
cr.Service = (function() {
	Service.prototype = new cr.IInstance();
	Service.prototype._stage = null;
	Service.prototype._names = null;
	Service.prototype._organizationLabels = null;
	Service.prototype._siteLabels = null;
	Service.prototype._offeringLabels = null;
	Service.prototype._services = null;
	
	Service.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service/{0}'.format(this.id());
	}
	
	Service.prototype.stage = function(newValue)
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
	
	Service.prototype.names = cr.NamedInstance.prototype.names;
	
	Service.prototype.organizationLabels = function(newData)
	{
		if (newData === undefined)
			return this._organizationLabels;
		else
		{
			this._organizationLabels = newData.map(function(d)
				{
					var i = new cr.ServiceOrganizationLabel();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.siteLabels = function(newData)
	{
		if (newData === undefined)
			return this._siteLabels;
		else
		{
			this._siteLabels = newData.map(function(d)
				{
					var i = new cr.ServiceSiteLabel();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.offeringLabels = function(newData)
	{
		if (newData === undefined)
			return this._offeringLabels;
		else
		{
			this._offeringLabels = newData.map(function(d)
				{
					var i = new cr.ServiceOfferingLabel();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.serviceImplications = function(newData)
	{
		if (newData === undefined)
			return this._services;
		else
		{
			this._services = newData.map(function(d)
				{
					var i = new cr.ServiceImplication();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.NamedInstance.prototype.setData.call(this, d, cr.ServiceName);

		this._stage = 'stage' in d ? d['stage'] : "";

		if ('organization labels' in d)
			this.organizationLabels(d['organization labels']);
		if ('site labels' in d)
			this.siteLabels(d['site labels']);
		if ('offering labels' in d)
			this.offeringLabels(d['offering labels']);
		if ('services' in d)
			this.serviceImplications(d['services']);
	}
	
    Service.servicesPromise = function()
    {
        if (cr.Service._servicesPromise)
        	return cr.Service._servicesPromise;
        
        cr.Service._servicesPromise = cr.getData(
        	{
        		path: 'service',
        		fields: ['services'],
        		resultType: cr.Service
        	})
        	.done(function(services)
        		{
        			result = $.Deferred();
        			result.resolve(services);
        			return result;
        		});
        return cr.Service._servicesPromise;
    }
    
	Service.prototype.stageColumns = {
		Housing: 0,
		Studying: 1,
		Certificate: 1,
		Training: 2,
		Whatever: 2,
		Working: 3,
		Teaching: 3,
		Expert: 3,
		Skills: 4,
		Mentoring: 5,
		Tutoring: 5,
		Coaching: 5,
		Volunteering: 5,
		Wellness: 6,
	};
	
	Service.prototype.getStageDescription = function(stage)
	{
		return stage in this.stageColumns && stage;
	}
	
	Service.prototype.getColumn = function()
	{
		var stage = this.stage();
		var stageDescription = this.getStageDescription(stage);
		if (stageDescription)
			return this.stageColumns[stageDescription];
		var _this = this;
			
		if (this.id())
		{
			var services = this.serviceImplications();
			/* services may be null if the service has been deleted */
			var s = services && services.map(function(s)
				{
					return s.service();
				})
				.find(function(s)
				{
					var stage =  s.stage();
					return s.getStageDescription(stage);
				});
			if (s)
				return this.stageColumns[
					s.getStageDescription(s.stage())
				];
		}

		/* Other */
		return 7;
	}
	
	Service.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	Service.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	Service.prototype.flagColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].flagColor;
	}
	
	Service.prototype.poleColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].poleColor;
	}
	
	/* Returns True if the service contains the specified text. */
	Service.prototype.descriptionContains = function(s, prefix)
	{
		var re = new RegExp(prefix + s.replace(/([\.\\\/\^\+])/, "\\$1"), "i");
		if (re.test(this.description()))
			return true;
		
		var services = this.serviceImplications();
		return services.find(function(d) { return d.description().toLocaleUpperCase() == s; });	
	}
	
	function Service() {
	    cr.IInstance.call(this);
	};
	
	return Service;

})();
cr.Service._servicesPromise = null;
	
cr.Service.clearPromises = function()
{
	cr.Service._servicesPromise = null;
}

cr.ServiceName = (function() {
	ServiceName.prototype = new cr.TranslationInstance();
	
	ServiceName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service name/{0}'.format(this.id());
	}
	
	function ServiceName() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceName;

})();
	
cr.ServiceOrganizationLabel = (function() {
	ServiceOrganizationLabel.prototype = new cr.TranslationInstance();
	
	ServiceOrganizationLabel.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service organization label/{0}'.format(this.id());
	}
	
	function ServiceOrganizationLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceOrganizationLabel;

})();
	
cr.ServiceSiteLabel = (function() {
	ServiceSiteLabel.prototype = new cr.TranslationInstance();
	
	ServiceSiteLabel.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service site label/{0}'.format(this.id());
	}
	
	function ServiceSiteLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceSiteLabel;

})();
	
cr.ServiceOfferingLabel = (function() {
	ServiceOfferingLabel.prototype = new cr.TranslationInstance();
	
	ServiceOfferingLabel.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service offering label/{0}'.format(this.id());
	}
	
	function ServiceOfferingLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceOfferingLabel;

})();
	
cr.ServiceImplication = (function() {
	ServiceImplication.prototype = new cr.ServiceLinkInstance();
	
	ServiceImplication.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service implication/{0}'.format(this.id());
	}
	
	function ServiceImplication() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return ServiceImplication;

})();
	
cr.Session = (function() {
	Session.prototype = new cr.IInstance();
	Session.prototype._names = null;
	Session.prototype._registrationDeadline = null;
	Session.prototype._start = null;
	Session.prototype._end = null;
	Session.prototype._canRegister = null;
	Session.prototype._inquires = null;
	Session.prototype._enrollments = null;
	Session.prototype._engagements = null;
	Session.prototype._periods = null;
	Session.prototype._inquiriesPromise = null;
	Session.prototype._enrollmentsPromise = null;
	Session.prototype._engagementsPromise = null;
	Session.prototype._periodsPromise = null;
	Session.prototype._organization = null;
	Session.prototype._site = null;
	Session.prototype._offering = null;
	
	Session.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'session/{0}'.format(this.id());
	}
	
	Session.prototype.names = cr.NamedInstance.prototype.names;
	Session.prototype.start = cr.DateRangeInstance.prototype.start;
	Session.prototype.end = cr.DateRangeInstance.prototype.end;
	Session.prototype.dateRange = cr.DateRangeInstance.prototype.dateRange;

	Session.prototype.registrationDeadline = function(newValue)
	{
		if (newValue === undefined)
			return this._registrationDeadline;
		else
		{
		    if (newValue != this._registrationDeadline)
		    {
				this._registrationDeadline = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.canRegister = function(newValue)
	{
		if (newValue === undefined)
			return this._canRegister;
		else
		{
		    if (newValue != this._canRegister)
		    {
				this._canRegister = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.inquiries = function(newData)
	{
		if (newData === undefined)
			return this._inquiries;
		else
		{
			this._inquiries = newData.map(function(d)
				{
					var i = new cr.Inquiry();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.enrollments = function(newData)
	{
		if (newData === undefined)
			return this._enrollments;
		else
		{
			this._enrollments = newData.map(function(d)
				{
					var i = new cr.Enrollment();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.engagements = function(newData)
	{
		if (newData === undefined)
			return this._engagements;
		else
		{
			this._engagements = newData.map(function(d)
				{
					var i = new cr.Engagement();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.periods = function(newData)
	{
		if (newData === undefined)
			return this._periods;
		else
		{
			this._periods = newData.map(function(d)
				{
					var i = new cr.Period();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.offering = function(newValue)
	{
		if (newValue === undefined)
			return this._offering;
		else
		{
		    if (newValue != this._offering)
		    {
				this._offering = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.site = function(newValue)
	{
		if (newValue === undefined)
			return this._site;
		else
		{
		    if (newValue != this._site)
		    {
				this._site = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.organization = function(newValue)
	{
		if (newValue === undefined)
			return this._organization;
		else
		{
		    if (newValue != this._organization)
		    {
				this._organization = newValue;
			}
			return this;
		}
	}
	
    Session.prototype.promiseInquiries = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._inquiriesPromise)
        	return this._inquiriesPromise;
        else if (this._inquiries)
        {
        	result = $.Deferred();
        	result.resolve(this._inquiries);
        	return result;
        }
        
        var _this = this;	
        this._inquiriesPromise = cr.getData(
        	{
        		path: 'session/{0}/inquiry'.format(this.id()),
        		fields: [],
        		resultType: cr.Inquiry
        	})
        	.done(function(inquiries)
        		{
        			_this._inquiries = inquiries;
        			_this._inquiries.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(inquiries);
        			return result;
        		});
        return this._inquiriesPromise;
    }
    
    Session.prototype.promiseEnrollments = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._enrollmentsPromise)
        	return this._enrollmentsPromise;
        else if (this._enrollments)
        {
        	result = $.Deferred();
        	result.resolve(this._enrollments);
        	return result;
        }
        
        var _this = this;	
        this._enrollmentsPromise = cr.getData(
        	{
        		path: 'session/{0}/enrollment'.format(this.id()),
        		fields: [],
        		resultType: cr.Enrollment
        	})
        	.done(function(enrollments)
        		{
        			_this._enrollments = enrollments;
        			_this._enrollments.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(enrollments);
        			return result;
        		});
        return this._enrollmentsPromise;
    }
    
    Session.prototype.promiseEngagements = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._engagementsPromise)
        	return this._engagementsPromise;
        else if (this._engagements)
        {
        	result = $.Deferred();
        	result.resolve(this._engagements);
        	return result;
        }
        
        var _this = this;	
        this._engagementsPromise = cr.getData(
        	{
        		path: 'session/{0}/engagement'.format(this.id()),
        		fields: [],
        		resultType: cr.Engagement
        	})
        	.done(function(engagements)
        		{
        			_this._engagements = engagements;
        			_this._engagements.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(engagements);
        			return result;
        		});
        return this._engagementsPromise;
    }
    
	Session.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.DateRangeInstance.prototype.setData.call(this, d);
		cr.NamedInstance.prototype.setData.call(this, d, cr.SessionName);

		this._registrationDeadline = 'registration deadline' in d ? d['registration deadline'] : "";
		this._canRegister = 'can register' in d ? d['can register'] : "";
		if ('inquiries' in d)
			this._inquiries = d['inquiries'].map(function(d) {
								var i = new cr.Inquiry();
								i.setData(d);
								return i;
							});
		if ('enrollments' in d)
			this._enrollments = d['enrollments'].map(function(d) {
								var i = new cr.Enrollment();
								i.setData(d);
								return i;
							});
		if ('engagements' in d)
			this._engagements = d['engagements'].map(function(d) {
								var i = new cr.Engagement();
								i.setData(d);
								return i;
							});
		if ('periods' in d)
			this._periods = d['periods'].map(function(d) {
								var i = new cr.Period();
								i.setData(d);
								return i;
							});

		if ('offering' in d)
		{
			this._offering = new cr.Offering();
			this._offering.setData(d['offering']);
			this._offering = crp.pushInstance(this._offering);
		}
		if ('site' in d)
		{
			this._site = new cr.Site();
			this._site.setData(d['site']);
			this._site = crp.pushInstance(this._site);
		}
		if ('organization' in d)
		{
			this._organization = new cr.Organization();
			this._organization.setData(d['organization']);
			this._organization = crp.pushInstance(this._organization);
		}
    }
    
	Session.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		cr.DateRangeInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._registrationDeadline) this._registrationDeadline = source._registrationDeadline;
		if (!this._canRegister) this._canRegister = source._canRegister;
		if (!this._inquiries && source._inquiries)
			this._inquiries = source._inquiries;
		if (!this._enrollments && source._enrollments)
			this._enrollments = source._enrollments;
		if (!this._engagements && source._engagements)
			this._engagements = source._engagements;
		if (!this._periods && source._periods)
			this._periods = source._periods;
		return this;
    }
    
	/** For a newly created Session, set its contents to valid values. */
	Session.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		cr.DateRangeInstance.prototype.setDefaultValues.call(this);
		this._webSite = "";
		this._registrationDeadline = "";
		this._canRegister = 'no';
		this._names = [];
		this._inquiries = [];
		this._enrollments = [];
		this._engagements = [];
		this._periods = [];
	}
	
	Session.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (cr.DateRangeInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		
		if ('web site' in d)
		{
			this._webSite = d['web site'];
			changed = true;
		}
		if ('registration deadline' in d)
		{
			this._registrationDeadline = d['registration deadline'];
			changed = true;
		}
		if ('can register' in d)
		{
			this._canRegister = d['can register'];
			changed = true;
		}
		if ('names' in d)
		{
			if (this.updateList(this.names, d['names'], newIDs, cr.SessionName, "nameAdded.cr", "nameDeleted.cr"))
				changed = true;
		}
		if ('inquiries' in d)
		{
			if (this.updateList(this.inquiries, d['inquiries'], newIDs, cr.Inquiry, "inquiryAdded.cr", "inquiryDeleted.cr"))
				changed = true;
		}
		
		if ('enrollments' in d)
		{
			if (this.updateList(this.enrollments, d['enrollments'], newIDs, cr.Enrollment, "enrollmentAdded.cr", "enrollmentDeleted.cr"))
				changed = true;
		}
		
		if ('engagements' in d)
		{
			if (this.updateList(this.engagements, d['engagements'], newIDs, cr.Engagement, "engagementAdded.cr", "engagementDeleted.cr"))
				changed = true;
		}
		
		if ('periods' in d)
		{
			if (this.updateList(this.periods, d['periods'], newIDs, cr.Period, "periodAdded.cr", "periodDeleted.cr"))
				changed = true;
		}
		
		if (changed)
		{
			$(this).trigger("changed.cr", this);
		}
		
		return changed;
	}
	
    Session.prototype.getData = function()
    {
    	/* Do not get the inquiries, enrollments or engagements, as these may number in the thousands. */
    	var _this = this;
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['periods'],
        		resultType: cr.Session
        	})
        	.then(function()
        	{
        		return _this;
        	});
    }
    
	function Session() {
	    cr.IInstance.call(this);
	};
	
	return Session;

})();
	
cr.SessionName = (function() {
	SessionName.prototype = new cr.TranslationInstance();
	
	SessionName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'session name/{0}'.format(this.id());
	}
	
	function SessionName() {
	    cr.TranslationInstance.call(this);
	};
	
	return SessionName;

})();
	
cr.Site = (function() {
	Site.prototype = new cr.IInstance();
	Site.prototype._webSite = null;
	Site.prototype._names = null;
	Site.prototype._offerings = null;
	Site.prototype._address = null;
	Site.prototype._organization = null;
	Site.prototype._dataPromise = null;

	Site.prototype.webSite = cr.WebSiteInstance.prototype.webSite;
	Site.prototype.names = cr.NamedInstance.prototype.names;
	
	Site.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'site/{0}'.format(this.id());
	}
	
	Site.prototype.offerings = function(newValue)
	{
		if (newValue === undefined)
			return this._offerings;
		else
		{
		    if (newValue != this._offerings)
		    {
				this._offerings = newValue;
			}
			return this;
		}
	}
	
	Site.prototype.address = function(newValue)
	{
		if (newValue === undefined)
			return this._address;
		else
		{
		    if (newValue != this._address)
		    {
				this._address = newValue;
			}
			return this;
		}
	}
	
	Site.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	
	/** Sets the data for this Site based on a dictionary of data that
		came from the server.
	 */
	Site.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		cr.NamedInstance.prototype.setData.call(this, d, cr.SiteName);
		
		this._webSite = 'web site' in d ? d['web site'] : "";
		if ('address' in d)
		{
			this._address = new cr.Address();
			this._address.setData(d['address']);
		}
		if ('offerings' in d)
			this._offerings = d['offerings'].map(function(d) {
								var i = new cr.Offering();
								i.setData(d);
								return crp.pushInstance(i);
							});
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
    }
    
    /** Merge the contents of the specified source into this Site for
    	values that are not specified herein.
     */
	Site.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._names && source._names)
			this._names = source._names;
		if (source._address)
		{
			if (!this._address)
				this._address = new cr.Address();
			this._address.mergeData(source._address);
		}
		if (!this._offerings && source._offerings)
			this._offerings = source._offerings;
		/* Set organization separately. */
		return this;
	}
	
	/** For a newly created Site, set its contents to valid values. */
	Site.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._webSite = "";
		this._names = [];
		this._address = new cr.Address();
		this._address.setDefaultValues();
		this._offerings = [];
	}
	
	/** Called after the contents of the Site have been updated on the server. */
	Site.prototype.updateData = function(d, newIDs)
	{
		var changed = false;

		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('web site' in d)
		{
			this._city = d['web site'];
			changed = true;
		}
		if ('address' in d)
		{
			if (this._address.updateData(d['address'], newIDs))
				changed = true;
		}
		if ('names' in d)
		{
			if (this.updateList(this.names, d['names'], newIDs, cr.SiteName, "nameAdded.cr", "nameDeleted.cr"))
				changed = true;
		}
		if ('offerings' in d)
		{
			if (this.updateList(this.offerings, d['offerings'], newIDs, cr.Offering, "offeringAdded.cr", "offeringDeleted.cr"))
				changed = true;
		}
		
		return changed;
	}
	
    Site.prototype.getData = function()
    {
    	var _this = this;
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: ['address', 'offerings'],
        		resultType: cr.Site
        	})
        	.then(function()
        	{
        		_this.address()._dataLoaded = true;
        		return _this;
        	});
    }
    
	function Site() {
	    cr.IInstance.call(this);
	};
	
	return Site;

})();
	
cr.SiteName = (function() {
	SiteName.prototype = new cr.TranslationInstance();
	
	SiteName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'site name/{0}'.format(this.id());
	}
	
	function SiteName() {
	    cr.TranslationInstance.call(this);
	};
	
	return SiteName;

})();
	
cr.Street = (function() {
	Street.prototype = new cr.IInstance();
	Street.prototype._position = null;
	Street.prototype._text = null;
	
	Street.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'street/{0}'.format(this.id());
	}
	
	Street.prototype.position = function(newValue)
	{
		if (newValue === undefined)
			return this._position;
		else
		{
		    if (newValue != this._position)
		    {
				this._position = newValue;
			}
			return this;
		}
	}
	
	Street.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this street based on a dictionary of data that
		came from the server.
	 */
	Street.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._position = 'position' in d ? d['position'] : "";
		this._text = 'text' in d ? d['text'] : "";
    }
    
    /** Merge the contents of the specified source into this Street for
    	values that are not specified herein.
     */
	Street.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (this._position === null) this._position = source._position;
		if (!this._text) this._text = source._text;
		return this;
	}
	
	/** For a newly created street, set its contents to valid values. */
	Street.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._position = "";
		this._text = "";
	}
	
	/** Called after the contents of the Street have been updated on the server. */
	Street.prototype.updateData = function(d, newIDs)
	{
		var changed = false;

		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('position' in d)
		{
			this._position = d['position'];
			changed = true;
		}
		if ('text' in d)
		{
			this._text = d['text'];
			changed = true;
		}
		
		return changed;
	}
	
	function Street() {
	    cr.IInstance.call(this);
	};
	
	return Street;

})();

cr.User = (function() {
	User.prototype = new cr.Grantable();
	User.prototype._firstName = null;
	User.prototype._lastName = null;
	User.prototype._birthday = null;
	User.prototype._systemAccess = null;
	User.prototype._emails = null;
	User.prototype._notifications = null;
	User.prototype._notificationsPromise = null;
	User.prototype._path = null;
	User.prototype._pathPromise = null;
	User.prototype._userGrantRequests = null;
	User.prototype._userGrantRequestsPromise = null;
	
	User.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user/{0}'.format(this.id());
	}
	
	User.prototype.clear = function()
	{
		cr.IInstance.prototype.clear.call(this);
		this._firstName = null;
		this._lastName = null;
		this._birthday = null;
		this._systemAccess = null;
		this._emails = null;
		this._notifications = null;
		this._notificationsPromise = null;
		this._path = null;
		this._pathPromise = null;
		this._userGrantRequests = null;
		this._userGrantRequestPromise = null;
	}
	
	User.prototype.setDefaultValues = function()
	{
		this._firstName = "";
		this._lastName = "";
		this._birthday = "";
		this._systemAccess = "read";
		this._emails = [];
		this._notifications = [];
		this._path = new cr.Path();
		this._userGrantRequests = [];
	}
	
	User.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		this._firstName = 'first name' in d ? d['first name'] : "";
		this._lastName = 'last name' in d ? d['last name'] : "";
		this._birthday = 'birthday' in d ? d['birthday'] : "";
		this._systemAccess = 'system access' in d ? d['system access'] : null;
		if ('emails' in d)
			this.emails(d['emails']);
		else
			this._emails = null;
		if ('notifications' in d)
			this.notifications(d['notifications']);
		else
			this._notifications = null;
		if ('path' in d)
			this.path(d['path']);
		else
			this._path = null;
		if ('user grant requests' in d)
			this.userGrantRequests(d['user grant requests']);
		else
			this._userGrantRequests = null;
			
		/* Clear all of the promises. */
		this._notificationsPromise = null;
		this._pathPromise = null;
		this._userGrantRequestPromise = null;
	}
	
	User.prototype.mergeData = function(source)
	{
		cr.Grantable.prototype.mergeData.call(this, source);
		if (!this._firstName) this._firstName = source._firstName;
		if (!this._lastName) this._lastName = source._lastName;
		if (!this._birthday) this._birthday = source._birthday;
		if (!this._systemAccess) this._systemAccess = source._systemAccess;
		return this;
	}
	
	User.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.Grantable.prototype.updateData.call(this, d, newIDs))
			changed = true;
		
		if ('first name' in d)
		{
			this._firstName = d['first name'];
			changed = true;
		}
		if ('last name' in d)
		{
			this._lastName = d['last name'];
			changed = true;
		}
		if ('birthday' in d)
		{
			this._birthday = d['birthday'];
			this.path().birthday(this._birthday.substr(0, 7));
			changed = true;
		}
		if ('path' in d)
		{
			if (this.path().updateData(d['path'], newIDs))
				changed = true;
		}
		
		if ('user grant requests' in d)
		{
			if (this.updateList(this.userGrantRequests, d['user grant requests'], newIDs, cr.UserGrantRequest, "userGrantRequestAdded.cr", "userGrantRequestDeleted.cr"))
				changed = true;
		}
		
		if (changed)
		{
			$(this).trigger("changed.cr", this);
		}
		
		return changed;
	}
	
	User.prototype.firstName = function(newValue)
	{
		if (newValue === undefined)
			return this._firstName;
		else
		{
		    if (newValue != this._firstName)
		    {
				this._firstName = newValue;
			}
			return this;
		}
	}
	
	User.prototype.lastName = function(newValue)
	{
		if (newValue === undefined)
			return this._lastName;
		else
		{
		    if (newValue != this._lastName)
		    {
				this._lastName = newValue;
			}
			return this;
		}
	}
	
	User.prototype.fullName = function()
	{
		var firstName = this.firstName();
		var lastName = this.lastName();
		if (firstName)
		{
			if (lastName)
				return firstName + " " + lastName;
			else
				return firstName;
		}
		else 
			return lastName;
	}
	
	User.prototype.caption = function()
	{
		return this.fullName() || this.description();
	}
	
	User.prototype.birthday = function(newValue)
	{
		if (newValue === undefined)
			return this._birthday;
		else
		{
		    if (newValue != this._birthday)
		    {
				this._birthday = newValue;
			}
			return this;
		}
	}
	
	User.prototype.appendUpdateBirthdayCommand = function(newValue, initialData, sourceObjects)
	{
		if (!newValue)
			throw new Error("Your birthday is required.");
		var birthMonth = newValue.substr(0, 7);
		if (birthMonth.length < 7)
			throw new Error("Your birthday must include a year and a month.");
		this.appendUpdateValueCommand(newValue, 
			this.birthday, 'birthday', initialData, sourceObjects);
		
		var subData = {};
		var subSourceObjects = [];
		this.path().appendUpdateValueCommand(birthMonth, 
		    this.path().birthday, 'birthday', subData, subSourceObjects);
		if (subSourceObjects.length > 0)
		{
			if (!('path' in initialData))
				initialData['path'] = {'id': this.path().id()};
			initialData['path']['birthday'] = subData['birthday'];
			for (var i = 0; i < subSourceObjects.length; ++i)
				sourceObjects.push(subSourceObjects[0]);
		}
	}

	User.prototype.name = function()
	{
		var firstName = user.firstName();
		var lastName = user.lastName();
		if (firstName)
		{
			if (lastName)
				return firstName + " " + lastName;
			else
				return firstName;
		}
		else 
			return lastName;
	}
	
	User.prototype.systemAccess = function(newSystemAccess)
	{
		if (newSystemAccess === undefined)
			return this._systemAccess;
		else
		{
			this._systemAccess = newSystemAccess;
			return this;
		}
	}
	
	User.prototype.path = function(newData)
	{
		if (newData === undefined)
			return this._path;
		else if (newData instanceof cr.Path)
		{
			this._path = newData;
			return this;
		}
		else
		{
			this._path = new cr.Path();
			this._path.setData(newData);
			return this;
		}
	}
	
	User.prototype.emails = function(newData)
	{
		if (newData === undefined)
			return this._emails;
		else
		{
			this._emails = newData.map(function(d)
				{
					var i = new cr.UserEmail();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	User.prototype.notifications = function(newData)
	{
		if (newData === undefined)
			return this._notifications;
		else
		{
			this._notifications = newData.map(function(d)
				{
					var i = new cr.Notification();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	User.prototype.userGrantRequests = function(newData)
	{
		if (newData === undefined)
			return this._userGrantRequests;
		else
		{
			var _this = this;
			this._userGrantRequests = newData.map(function(d)
				{
					var i = new cr.UserUserGrantRequest();
					i.user(_this)
					 .setData(d);
					return i;
				});
			return this;
		}
	}
	
    User.prototype.promisePath = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._pathPromise)
        	return this._pathPromise;
        else if (this._path)
        {
        	result = $.Deferred();
        	result.resolve(this._path);
        	return result;
        }
        
        var _this = this;	
        this._pathPromise = cr.getData(
        	{
        		path: 'user/{0}/path'.format(this.id()),
        		fields: ['experiences', 'experiences/services', 'experiences/custom services'],
        		resultType: cr.Path
        	})
        	.done(function(paths)
        		{
        			_this._path = paths[0];
        			result = $.Deferred();
        			result.resolve(paths[0]);
        			return result;
        		});
        return this._pathPromise;
    }
    
    User.prototype.promiseUserGrantRequests = function()
    {
    	p = this.administerCheckPromise();
    	if (p) return p;

        if (this._userGrantRequestsPromise)
        	return this._userGrantRequestsPromise;
        else if (this._userGrantRequests)
        {
        	result = $.Deferred();
        	result.resolve(this._userGrantRequests);
        	return result;
        }
        
        var _this = this;	
        this._userGrantRequestsPromise = cr.getData(
        	{
        		path: 'user/{0}/user grant request'.format(this.id()),
        		fields: [],
        		resultType: cr.UserUserGrantRequest
        	})
        	.done(function(userGrantRequests)
        		{
        			_this._userGrantRequests = userGrantRequests;
        			_this._userGrantRequests.forEach(function(i)
        				{
        					i.user(_this);
        				});
        			result = $.Deferred();
        			result.resolve(userGrantRequests);
        			return result;
        		});
        return this._userGrantRequestsPromise;
    }
    
    User.prototype.promiseNotifications = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._notificationsPromise)
        	return this._notificationsPromise;
        else if (this._notifications)
        {
        	result = $.Deferred();
        	result.resolve(this._notifications);
        	return result;
        }
        
        var _this = this;	
        this._notificationsPromise = cr.getData(
        	{
        		path: 'user/{0}/notification'.format(this.id()),
        		fields: [],
        		resultType: cr.Notification
        	})
        	.done(function(notifications)
        		{
        			_this._notifications = notifications;
        			result = $.Deferred();
        			result.resolve(notifications);
        			return result;
        		});
        return this._notificationsPromise;
    }
    
	User.prototype.promiseDataLoaded = function(fields)
	{
		if (this.privilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.description()));
			return result.promise();
		}
		if (this._dataLoaded)
		{
			var result = $.Deferred();
			result.resolve(this);
			return result.promise();
		}
		else if (this.id())
		{
			var _this = this;
			var jsonArray = {};
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields.filter(function(s) { return s.indexOf("/") < 0; }));
			return $.getJSON(cr.urls.getData + this.urlPath() + "/", jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							/* If the data length is 0, then this item can not be read. */
							if (json.data.length > 0)
							{
								_this.setData(json.data[0]);
							}
							else
							{
								_this.setDefaultValues();
								_this.privilege(null);
							}
							
							r2.resolve(_this);
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 )
				.then(function(instance)
					{
						if (!fields)
							return;
							
						var subFields = fields.filter(function(s) { return s.indexOf("/") >= 0; });
						if (subFields.length == 0)
							return;
						try
						{
							debugger;
							// This code is used to get subField data. Is this necessary?
// 							return $.when.apply(null, subFields.map(
// 									function(s) {
// 										var cellName = s.substring(0, s.indexOf("/"));
// 										var fieldNames = s.substring(s.indexOf("/") + 1).split(",");
// 										try
// 										{
// 											return cr.getCellValues(_this, cellName, fieldNames); 
// 										}
// 										catch(err)
// 										{
// 											var r3 = $.Deferred();
// 											r3.reject(err);
// 											return r3;
// 										}
// 									}))
// 								.then(function()
// 									{
// 										var r3 = $.Deferred();
// 										r3.resolve(cells);
// 										return r3;
// 									},
// 									function(err)
// 									{
// 										var r3 = $.Deferred();
// 										r3.reject(err);
// 										return r3;
// 									});
						}
						catch(err)
						{
							var r3 = $.Deferred();
							r3.reject(err);
							return r3;
						}
					}
				);
		}
		else
		{
			this.setDefaultValues();
		}
	}
	
	User.prototype.deletedUserGrantRequest = function(i)
	{
		cr.removeElement(this._userGrantRequests, i);
		$(this).trigger("userGrantRequestDeleted.cr", i);
	}
	
	function User() {
	    cr.Grantable.call(this);
	};
	
	return User;

})();
	
cr.UserEmail = (function() {
	UserEmail.prototype = new cr.IInstance();
	
	UserEmail.prototype._text = null;
	UserEmail.prototype._position = null;
	
	UserEmail.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user email/{0}'.format(this.id());
	}
	
	UserEmail.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
			if (this._text != newValue)
			{
				this._text = newValue;
			}
			return this;
		}
	}
	
	UserEmail.prototype.setDefaultValues = function()
	{
		this._text = "";
		this._position = 0;
	}
	
	UserEmail.prototype.setData = function(d)
	{
		this._text = 'text' in d ? d['text'] : "";
		this._position = 'position' in d ? parseInt(d['position']) : 0;
	}
	
	function UserEmail() {
	    cr.IInstance.call(this);
	};
	
	return UserEmail;

})();
	
cr.UserGrant = (function() {
	UserGrant.prototype = new cr.Grant();
	
	UserGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user grant/{0}'.format(this.id());
	}
	
	UserGrant.prototype.granteeType = function()
	{
		return cr.User;
	}
	
	function UserGrant() {
	    cr.Grant.call(this);
	};
	
	return UserGrant;

})();
	
cr.UserUserGrantRequest = (function() {
	UserUserGrantRequest.prototype = new cr.IInstance();
	UserUserGrantRequest.prototype._user = null;	/* The container for this user grant request */
	UserUserGrantRequest.prototype._grantee = null;
	
	UserUserGrantRequest.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user user grant request/{0}'.format(this.id());
	}
	
	UserUserGrantRequest.prototype.setDefaultValues = function()
	{
		this._grantee = null;
	}
	
	UserUserGrantRequest.prototype.grantee = function(newValue)
	{
		if (newValue === undefined)
			return this._grantee;
		else
		{
			var oldID = this._grantee && this._grantee.id();
		    if (newValue.id() != oldID)
		    {
				this._grantee = newValue;
			}
			return this;
		}
	}
	
	UserUserGrantRequest.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
			var oldID = this._user && this._user.id();
		    if (newValue.id() != oldID)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
	UserUserGrantRequest.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._grantee = new cr.User();
		this._grantee.setData(d['grantee']);
		this._grantee = crp.pushInstance(this._grantee);
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.pushInstance(this._user);
		}
	}
	
	UserUserGrantRequest.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._grantee)
			this._grantee = source._grantee;
		return this;
	}
	
	UserUserGrantRequest.prototype.deleted = function()
	{
		/* Delete from the container first, so that other objects know the container may be empty. */
		this.user().deletedUserGrantRequest(this);
	}
	
	function UserUserGrantRequest() {
	    cr.IInstance.call(this);
	};
	
	return UserUserGrantRequest;

})();
	
cr.signedinUser = new cr.User();

cr.createSignedinUser = function(id, description)
{
	cr.signedinUser.id(id)
	               .description(description)
	               .promiseDataLoaded(['path', cr.fieldNames.systemAccess, 'user grant requests', 'notifications'])
		.then(function()
			{
				$(cr.signedinUser).trigger("signin.cr");
			}, 
			cr.asyncFail);
}

/* Return a new date that will be a UTC date that represents the same date
	as now in the currrent time zone. For example, 10:00 p.m. in Boston on Oct. 21, 2016 should
	be a UTC date of Oct. 21, 2016 even though that time is actually a UTC Date of Oct. 22, 2016.
 */ 
function getUTCTodayDate()
{
	var startMinDate = new Date();
	return new Date(Date.UTC(startMinDate.getFullYear(), startMinDate.getMonth(), startMinDate.getDate(), 0, 0, 0));
}

/* Given an ISO Date string, return a locale date string */
function getLocaleDateString(s)
{
	if (s.length == 7)
		return Date.CultureInfo.monthNames[parseInt(s.substr(5)) - 1] + " " + s.substr(0, 4);
	else if (s.length == 10)
	{
		var a = new Date(s);
		
		/* Offset is set to set the time to 1:00 a.m. in the local time zone. Since creating
			a new date sets the time to midnight UTC, we need to set it an hour later in case 
			daylight saving's time is in effect. To account for different time zones, we 
			add an hour if the offset is positive, or subtract an hour if the offset is negative.
		 */
		var offset = (a.getTimezoneOffset()) * 60 * 1000;
		
		if (offset >= 0)
			offset += 60 * 60 * 1000;
		else
			offset -= 60 * 60 * 1000;
			
		a.setTime(a.getTime() + offset);
		return a.toLocaleDateString();
	}
	else
		return s;
}

