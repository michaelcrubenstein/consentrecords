		/* Add the functionality to a javascript object to attach event targets and
			trigger events on them. This allows events to be fired on model objects.
		 */

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
	CRP.prototype.paths = {};
	CRP.prototype.promises = {};
	CRP.prototype.queue = null;
	
    function CRP() {
    	this.instances = {};
    	this.paths = {};
        this.queue = new Queue(true); //initialize the queue
    };
    
    CRP.prototype.clear = function() {
    	this.instances = {};
    	this.paths = {};
    	this.promises = {};
        this.queue = new Queue(true); //initialize the queue
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
		if (i.getInstanceID())
		{
			if (!(i.getInstanceID() in this.instances))
			{
				this.instances[i.getInstanceID()] = i;
				return i;
			}
			else
			{
				var oldInstance = this.instances[i.getInstanceID()];
				if (i.areCellsLoaded())
				{
					if (!oldInstance.getCells())
					{
						oldInstance.setCells(i.getCells());
					}
					else 
						i.getCells().forEach(function(cell)
							{
								if (!oldInstance.getCell(cell.field.name))
								{
									oldInstance.importCell(cell);
								}
							});
				}
				if (!oldInstance.getTypeName() && i.getTypeName())
					oldInstance.setTypeName(i.getTypeName());
				return oldInstance;
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
		var result = $.Deferred();
		cr.getData({path: args.path, 
					start: args.start,
					end: args.end,
					fields: args.fields})
			.done(function(newInstances)
				{
					var mappedInstances = newInstances.map(function(i) { return crp.pushInstance(i); });
					result.resolve(mappedInstances);
				})
			.fail(function(err)
				{
					_this.promises[args.path] = undefined;
					result.reject(err);
				});
		var promise = result.promise();
		this.promises[args.path] = promise;
		return promise;
	}
	
	return CRP;
})();

var crp = new CRP();

var cr = {}
	
cr.Cell = (function() 
	{
		Cell.prototype.data = [];
		Cell.prototype.field = null;
		
		Cell.prototype.setParent = function (parent)
		{
			this.parent = parent;
			if (this.field.descriptorType !== undefined && parent)
			{
				$(this).on("dataChanged.cr valueAdded.cr valueDeleted.cr", null, parent, parent._checkDescription);
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
			return this.field && this.field.capacity === "_unique value";
		}

		Cell.prototype.pushValue = function(newValue)
		{
			newValue.cell = this;		
			this.data.push(newValue);
			$(newValue).on("dataChanged.cr", null, this, function(eventObject) {
				$(eventObject.data).trigger("dataChanged.cr", eventObject.data);
			});
			$(newValue).on("valueDeleted.cr", null, this, function(eventObject) {
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
				oldData.clearValue();
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

	CellValue.prototype.getDescription = function()
cr.Value = (function() {
	{ 
		throw "getDescription must be overwritten";
	};
	
	Value.prototype.isEmpty = function()
	{
		throw "isEmpty must be overwritten";
	}
	
	Value.prototype.clearValue = function()
	{
		throw "clearValue must be overwritten";
	};
	
	Value.prototype.triggerDeleteValue = function()
	{
		/* Delete from the cell first, so that other objects know the cell may be empty. */
		if (this.cell)
		    this.cell.deleteValue(this);
		$(this).trigger("valueDeleted.cr", this);
	}
	
	CellValue.prototype.triggerDataChanged = function(changedValue)
	{
		changedValue = changedValue !== undefined ? changedValue : this;
		$(this).trigger("dataChanged.cr", changedValue);
	}
	
	Value.prototype.deleteValue = function(done, fail)
	{
		if (!fail)
			throw ("fail is not specified");
		if (!done)
			throw ("done is not specified");
			
		var _this = this;
		if (this.id == null)	/* It was never saved */
		{
			if (this.cell != null && 
				this.cell.parent == null &&
				this.getInstanceID() != null)
			{
				/* In this case, this is a root object, so we just need to 
					delete the instance. */
				var jsonArray = { path: "#" + this.getInstanceID()
						};
				$.post(cr.urls.deleteInstances, jsonArray)
					.done(function(json, textStatus, jqXHR)
					{
						if (done) 
						{
							_this.triggerDeleteValue();
							done(_this);
						}
					})
					.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, fail);
					});
			}
			else
			{
				_this.triggerDeleteValue();
				done(_this);
			}
		}
		else
		{
			var jsonArray = { valueID: this.id
					};
			$.post(cr.urls.deleteValue, jsonArray)
				.done(function(json, textStatus, jqXHR)
				{
					if (done) 
					{
						_this.triggerDeleteValue();
						done(_this);
					}
				})
				.fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, fail);
				});
		}
	};
			
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
	StringValue.prototype.clearValue = function() { this.text = null; }

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
	
	TranslationValue.prototype.clearValue = function() { this.text = null; this.languageCode = null; }

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
	
cr.ObjectValue = (function() {
	ObjectValue.prototype = new cr.CellValue();
	ObjectValue.prototype._instanceID = null;
	ObjectValue.prototype._description = "None";
	ObjectValue.prototype._typeName = null;
	ObjectValue.prototype._privilege = null;
	ObjectValue.prototype._cells = null;
	
	ObjectValue.prototype.getDescription = function() 
	{ 
		return this._description;
	};
	
	ObjectValue.prototype.setDescription = function(newDescription)
	{
		this._description = newDescription.length > 0 ? newDescription : "None";
	}
	
	ObjectValue.prototype.getInstanceID = function()
	{
		return this._instanceID;
	};
	
	ObjectValue.prototype.setInstanceID = function(instanceID)
	{
		this._instanceID = instanceID;
		return this;
	}
	
	ObjectValue.prototype.getTypeName = function()
	{
		return this._typeName;
	}
	
	ObjectValue.prototype.setTypeName = function(typeName)
	{
		this._typeName = typeName;
		return this;
	}
	
	ObjectValue.prototype.getPrivilege = function()
	{
		return this._privilege;
	}
	
	ObjectValue.prototype.setPrivilege = function(privilege)
	{
		this._privilege = privilege;
		return this;
	}
	
	ObjectValue.prototype.getCells = function()
	{
		return this._cells;
	}
	
	ObjectValue.prototype.areCellsLoaded = function()
	{
		return this._cells !== null;
	}

	ObjectValue.prototype.setCells = function(oldCells)
	{
		this._cells = oldCells;
		var _this = this;
		oldCells.forEach(function(cell) {
			cell.setParent(_this);
		});
		return this;
	}
	
	ObjectValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		var newValueID = (newValue ? newValue.getInstanceID() : null);
		var newDescription = (newValue ? newValue.getDescription() : null);

		/* If both are null, then they are equal. */
		if (!newValueID && !this.getInstanceID())
			return;
		
		var command;
		if (!newValueID)
		{
			if (!this.getInstanceID())
				return;
			else
			{
				command = {id: this.id};
				sourceObjects.push(this);
			}
		}
		else {
			if (this.getInstanceID() == newValueID)
				return;
			if (this.id)
			{
				command = {id: this.id, instanceID: newValueID, description: newDescription};
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
		}
		initialData.push(command);
		
	}

	ObjectValue.prototype.updateFromChangeData = function(changeData)
	{
		/* Replace the value completely so that its cells are eliminated and will be
			re-accessed from the server. This handles the case where a value has been added. */
		if (!changeData.instanceID)
			throw new Error("instanceID is not specified.");
		this._instanceID = changeData.instanceID;
		this.setDescription(changeData.description);
		this._cells = null;
	}
	
	ObjectValue.prototype._completeUpdate = function(newValue)
	{
		var oldID = this.getInstanceID();
		
		this.id = newValue.id;
		if (newValue.getTypeName())
			this.setTypeName(newValue.getTypeName());
		if (newValue.getPrivilege())
			this.setPrivilege(newValue.getPrivilege());
		this.updateFromChangeData({instanceID: newValue.getInstanceID(), description: newValue.getDescription()});
		this.triggerDataChanged();
		
		if (!oldID)
			$(this.cell).trigger('valueAdded.cr', this);
	}

	ObjectValue.prototype.isEmpty = function()
	{
		return !this.getInstanceID() && !this.getCells();
	}

	ObjectValue.prototype.clearValue = function()
	{
		this._instanceID = null; 
		this._description="None";
		this._privilege = null;
		this._cells = null;
	}
	
	ObjectValue.prototype.calculateDescription = function()
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
				if (cell.field.descriptorType == "_by text")
				{
					var cellNames = cell.data.filter(function (d) { return !d.isEmpty(); })
						.map(function (d) { return d.getDescription(); });
					if (cellNames.length > 0)
						nameArray.push(cellNames.join(separator=' '));
				}
				else if (cell.field.descriptorType == "_by first text")
				{
					var cellNames = cell.data.filter(function (d) { return !d.isEmpty(); })
						.map(function (d) { return d.getDescription(); });
					if (cellNames.length > 0)
						nameArray.push(cellNames[0]);
				}
				else if (cell.field.descriptorType == "_by count")
				{
					nameArray.push(cell.data.length.toString());
				}
			});
			this.setDescription(nameArray.length ? nameArray.join(separator = ' ') : "None");
		}
	}

	ObjectValue.prototype.hasTextDescription = function()
	{
		var cells = this.getCells();
		for (var i = 0; i < cells; ++i)
		{
			var cell = cells[i];
			if ((cell.field.descriptorType == "_by text" ||
			     cell.field.descriptorType == "_by first text") &&
				cell.data.length > 0)
				return true;
		}
		return false;
	}

	ObjectValue.prototype.getCell = function(name)
	{
		if (this.getCells())
			return this.getCells().find(function(cell)
				{
					return cell.field.name == name;
				});
		else
			return undefined;
	}

	ObjectValue.prototype.getDatum = function(name)
	{
		var cell = this.getCell(name);
		return cell && cell.data.length && cell.data[0].text;
	}
		
	ObjectValue.prototype.getValue = function(name)
	{
		var cell = this.getCell(name);
		return cell && cell.data.length && cell.data[0];
	}
	
	ObjectValue.prototype.getNonNullValue = function(name)
	{
		var d = this.getValue(name);
		if (d && d.getInstanceID())
			return d;
		else
			return undefined;
	}
		
	ObjectValue.prototype._handleContentsChanged = function(changedValue)
	{
		var oldDescription = this.getDescription();
		this.calculateDescription();
		if (this.getDescription() != oldDescription)
			this.triggerDataChanged(changedValue);
	}
	
	/* this method is attached to a cell when its contents are changed. */
	ObjectValue.prototype._checkDescription = function(eventObject, changedValue)
	{
		eventObject.data._handleContentsChanged(changedValue);
	}

	ObjectValue.prototype.importCell = function(oldCell)
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

	ObjectValue.prototype.importCells = function(oldCells)
	{
		this._cells = [];
		for (var j = 0; j < oldCells.length; ++j)
		{
			this.importCell(oldCells[j]);
		}
	}

	/* loadData loads the data from the middle tier or another ObjectValue. */
	ObjectValue.prototype.loadData = function(data)
	{
		if (data.id)
			this.id = data.id;
			
		if (data.getInstanceID)
			this.setInstanceID(data.getInstanceID());
		else if (data.instanceID)
			this.setInstanceID(data.instanceID);
		else
			this.setInstanceID(null);

		if (data.getDescription)
			this.setDescription(data.getDescription());
		else
			this.setDescription(data.description);
		
		if (data.getPrivilege)
			this.setPrivilege(data.getPrivilege());
		else if ("privilege" in data)
			this.setPrivilege(data.privilege);
			
		if (data.getTypeName)
			this.setTypeName(data.getTypeName());
		else if ("typeName" in data)
			this.setTypeName(data.typeName);
		
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
		this.importCells(data.cells);
		this.setPrivilege(data.privilege);
		if (data.typeName)
			this.setTypeName(data.typeName);
	}

	ObjectValue.prototype.promiseCells = function(fields)
	{
		if (this.getPrivilege() == "_find")
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
					if (fields.indexOf(cell.field.name) < 0)
						return false;
					if (cell.data.find(function(d)
						{
							return d.getInstanceID() && !d.areCellsLoaded();
						}))
						return true;
				}))
				return false;
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
			var jsonArray = { "path" : "#" + this.getInstanceID() };
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields.filter(function(s) { return s.indexOf("/") < 0; }));
			return $.getJSON(cr.urls.getData, jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
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
					}
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
					},
					cr.thenFail
				);
		}
		else if (this.cell.field.ofKindID)
		{
			var _this = this;
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			return cr.getConfiguration(this, this.cell.field.ofKindID)
				.done(function(newCells)
					{
						_this.setCells(newCells);
					});
		}
	}
	
	ObjectValue.prototype.promiseCellsFromCache = function(fields)
	{
		var storedI = crp.getInstance(this.getInstanceID());
		if (storedI && storedI.areCellsLoaded())
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
	
	/* This should be replaced by ObjectValue.prototype.promiseCells. */
	ObjectValue.prototype.checkCells = function(fields, done, fail)
	{
		if (typeof(done) != "function")
			throw "done is not a function";
		if (typeof(fail) != "function")
			throw "fail is not a function";
		if (this.getPrivilege() == "_find")
		{
			fail("You do not have permission to see information about {0}".format(this.getDescription()));
			return;
		}
	
		if (this.getCells() && this.areCellsLoaded())
		{
			done(this.getCells());
		}
		else if (this.getInstanceID())
		{
			var _this = this;
			var jsonArray = { "path" : "#" + this.getInstanceID() };
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields);
			$.getJSON(cr.urls.getData,
				jsonArray, 
				function(json)
				{
					try {
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
						done();
					}
					catch (err)
					{
						fail(err);
					}
				}
			)
			.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, fail);
					}
				 );
		}
		else if (this.cell.field.ofKindID)
		{
			var _this = this;
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			cr.getConfiguration(this, this.cell.field.ofKindID)
				.then(function(newCells)
					{
						_this.setCells(newCells);
						done(newCells);
					},
					fail);
		}
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
			
		return ["_write", "_administer"].indexOf(this.getPrivilege()) >= 0;
	}
	
	function ObjectValue() {
		cr.Value.call(this);
	};
	
	return ObjectValue;
})();

cr.signedinUser = new cr.ObjectValue();

cr.createSignedinUser = function(instanceID, description)
{
	cr.signedinUser._instanceID = instanceID;
	cr.signedinUser.setDescription(description);
	cr.signedinUser.promiseCellsFromCache(["_system access"])
		.then(function()
			{
				cr.signedinUser = crp.pushInstance(cr.signedinUser);
				$(cr.signedinUser).trigger("signin.cr");
			}, 
			cr.asyncFail);
}

cr.cellFactory = {
	_string: cr.StringCell,
	_number: cr.NumberCell,
	_email: cr.EmailCell,
	_url: cr.UrlCell,
	_telephone: cr.TelephoneCell,
	_translation: cr.TranslationCell, 
	_datestamp: cr.DatestampCell, 
	"_datestamp (day optional)": cr.DatestampDayOptionalCell,
	_time: cr.TimeCell,
	_object: cr.ObjectCell
}
	
cr.createCell = function(field) {
	var f = cr.cellFactory[field.dataType];
	return new f(field);
};
	
cr.urls = {
		selectAll : "/api/selectall/",
		getValues : "/api/getvalues/",
		getUserID : "/api/getuserid/",
		getData : "/api/getdata/",
		getConfiguration : "/api/getconfiguration/",
		createInstance : "/api/createinstance/",
		updateValues : "/api/updatevalues/",
		deleteValue : '/api/deletevalue/',
		deleteInstances : '/api/deleteinstances/',
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
		if (textStatus == "timeout")
			return "This operation ran out of time. Try again.";
		else if (jqXHR.status == 0)
			return "The server is not responding. Please try again.";
		else
			return jqXHR.statusText;
	};

cr.postFailed = function(jqXHR, textStatus, errorThrown, failFunction)
	{
		failFunction(cr.postError(jqXHR, textStatus, errorThrown));
	};

cr.thenFail = function(jqXHR, textStatus, errorThrown)
	{
		var r2 = $.Deferred();
		r2.reject(cr.postError(jqXHR, textStatus, errorThrown));
		return r2;
	};
	
	/* args is an object with up to five parameters: path, start, end, done, fail */
cr.selectAll = function(args)
	{
		if (!args.path)
			throw "path was not specified to selectAll";

		var data = {path : args.path};
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
		
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.selectAll, data)
			.then(
				function(json)
				{
					try
					{
						return json.objects.map(cr.ObjectCell.prototype.copyValue);
					}
					catch(err)
					{
						var r = $.Deferred();
						r.reject(err);
						return r.promise();
					}
				},
				cr.postError);
	};
	
	/* args is an object with up to seven parameters: path, field, value, start, end, done, fail.
		The done method takes a single argument, which is an array of value objects. */
cr.getValues = function (args)
	{
		var data = {};
		if (args.path)
			data.path = args.path;
		else
			throw "path was not specified to getValues"
			
		if (args.field)
			data.fieldName = args.field;
		else
			throw "field was not specified to getValues"
			
		if (args.value)
			data.value = args.value;
		if (args.fields)
			data.fields = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data.access_token = cr.accessToken;
			
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getValues, data)
			.then(function(json)
				{
					var newObjects = json.values.map(cr.ObjectCell.prototype.copyValue);
					try
					{
						if (args.done)
							args.done(newObjects);
						var result = $.Deferred();
						result.resolve(newObjects);
						return result;
					}
					catch(err)
					{
						if (args.fail)
							args.fail(err);
						var result = $.Deferred();
						result.reject(err);
						return result;
					}
				},
				function(jqXHR, textStatus, errorThrown)
				{
					var resultText = cr.postError(jqXHR, textStatus, errorThrown);
					if (args.fail)
						args.fail(resultText);
					var result = $.Deferred();
					result.reject(resultText);
					return result;
				});
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
					oldValue.updateFromChangeData(d);
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
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
			
		var jsonArray = { valueID: valueID
				};
		$.post(cr.urls.deleteValue, jsonArray)
			.done(function(json, textStatus, jqXHR)
			{
				successFunction(valueID);
			})
			.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			});
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
			
		if (containerUUID)
			jsonArray.containerUUID = containerUUID;
	
		return $.when($.post(cr.urls.createInstance, jsonArray))
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							var newValue = new cr.ObjectValue();
							newValue.loadData(json.object);
							
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
								d.id = newValueID;
						
								/* Object Values have an instance ID as well. */
								if (newInstanceID)
									initialData[i].instanceID = newInstanceID;
							
								d.updateFromChangeData(initialData[i]);
						
								if (update)
									update();
						
								d.triggerDataChanged();
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

cr.getConfiguration = function(parent, typeID)
	{
		return $.getJSON(cr.urls.getConfiguration,
						 { "typeID" : typeID })
		.then(function(json)
			{
				var cells = [];
				json.cells.forEach(function(cell)
				{
					var newCell = cr.createCell(cell.field);
					newCell.setup(parent);
					cells.push(newCell);
				});
				return cells;
			},
			cr.postError);
	},
	
	
/* 
	args is an object with up to four parameters: path, fields, done, fail
 */
cr.getData = function(args)
	{
		if (!args.path)
			throw new Error("path is not specified to getData");
			
		var data = {path : args.path}
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getData, data)
			.then(function(json)
				{
					var instances = json.data.map(cr.ObjectCell.prototype.copyValue);
					try
					{
						var result = $.Deferred();
						result.resolve(instances);
						if (args.done)
							args.done(instances);
						return result;
					}
					catch(err)
					{
						var result = $.Deferred();
						result.reject(err);
						if (args.fail)
							args.fail(err);
						return result;
					}
				},
				function(jqXHR, textStatus, errorThrown)
				{
					var resultText = cr.postError(jqXHR, textStatus, errorThrown);
					var result = $.Deferred();
						result.reject(resultText);
					if (args.fail)
						args.fail(resultText);
					return result;
				});
	}

/* Loads all of the elements of the specified cell within the specified object.
	If the cellName is the name of an objectCell, fieldNames determines the sub-cells that
	are also loaded at the same time.
 */
cr.getCellValues = function(object, cellName, fieldNames)
	{
		var path = '#{0}'.format(object.getInstanceID());
		return cr.getValues({path: path, field: cellName, fields: fieldNames})
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
				},
				cr.postError)
			.promise();
	}

cr.updateUsername = function(newUsername, password, done, fail)
	{
		$.post(cr.urls.updateUsername, {newUsername: newUsername, 
										password: password})
		.done(function(json)
			{
				var v = cr.signedinUser.getValue('_email');
				v.updateFromChangeData({text: newUsername});
				v.triggerDataChanged();
				done();
		   })
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}
	
cr.updatePassword = function(username, oldPassword, newPassword, done, fail)
	{
		$.post(cr.urls.updatePassword, {username: username,
										oldPassword: oldPassword,
										newPassword: newPassword })
		.done(done)
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}

cr.share = function(userPath, path, privilegeID, done, fail)
	{
		var url = cr.urls.acceptFollower;
		if (userPath)
			url += userPath + "/";
		$.post(url, {follower: path,
					 privilege: privilegeID
					})
		.done(function(json){
				/* Copy the data from json object into a new value so that 
					any functions are properly initialized.
				 */
				var newValue = new cr.ObjectValue();
				newValue.loadData(json.object);
				done(newValue);
		})
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}

cr.requestAccess = function(follower, followingPath, done, fail)
{
		$.post(cr.urls.requestAccess, {follower: follower.getInstanceID(),
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
							/* Copy the data from json object into newData so that 
								any functions are properly initialized.
							 */
							var newData;
							if (json.Comments)
							{
								var newComments = cr.ObjectCell.prototype.copyValue(json.Comments);
								var commentsCell = experience.getCell('Comments');
								commentsCell.replaceValues([newComments]);
								$(commentsCell).trigger('valueAdded.cr', newComments);
								newData = newComments.getValue('Comment');
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
