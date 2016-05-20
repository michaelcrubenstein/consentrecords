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
	CRP.prototype.configurations = {};
	CRP.prototype.queue = null;
	
    function CRP() {
    	this.instances = {};
    	this.paths = {};
    	this.configurations = {};
        this.queue = new Queue(true); //initialize the queue
    };
    
    CRP.prototype.clear = function() {
    	this.instances = {};
    	this.paths = {};
    	this.configurations = {};
        this.queue = new Queue(true); //initialize the queue
    };
    
    /* Get an instance that has been loaded, or undefined if it hasn't been loaded. */
    CRP.prototype.getInstance = function(id)
    {
    	if (!id)
    		throw("id is not defined");
    	if (id in this.instances)
    		return this.instances[id];
    	else
    		return undefined;
    }

	CRP.prototype.pushID = function(id, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
    	if (!id)
    		throw("id is not defined");
		var _this = this;
		this.queue.add(
			function() {
				if (id in _this.instances) {
					successFunction(_this.instances[id]);
				}
				else
				{
					cr.selectAll({path: "#"+id, 
						done: function(newInstances)
						{
							_this.instances[id] = newInstances[0];
							successFunction(newInstances[0]);
							_this.queue.next();
						}, 
						fail: failFunction} );
					return false;
				}
			});
	};
	
	CRP.prototype.pushCheckCells = function(i, fields, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		if (!i)
			throw "i is not defined";
		if (!i.getValueID())
			throw "i does not have an instanceID";
		if (i.privilege === "_find")
			throw "You do not have permission to see information about {0}".format(i.getDescription());

		var _this = this;
		this.queue.add(
			function() {
				var storedI = _this.getInstance(i.getValueID());
				if (storedI && storedI.isDataLoaded)
				{
					if (i !== storedI)
						i.importCells(storedI.cells);
					successFunction();
					return true;
				}
				else
				{
					i.checkCells(fields,
						function() {
							successFunction();
							_this.queue.next();
						},
						failFunction);
					return false;
				}
			});
	};
	
	CRP.prototype.pushInstance = function(i)
	{
		if (i.getValueID())
		{
			if (!(i.getValueID() in this.instances))
			{
				this.instances[i.getValueID()] = i;
				return i;
			}
			else
			{
				var oldInstance = this.instances[i.getValueID()];
				if (i.isDataLoaded)
				{
					if (!oldInstance.cells)
					{
						oldInstance._setCells(i.cells);
						oldInstance.isDataLoaded = true;
					}
					else 
						i.cells.forEach(function(cell)
							{
								if (!oldInstance.getCell(cell.field.name))
								{
									oldInstance.importCell(cell);
								}
							});
				}
				if (!oldInstance.typeName && i.typeName)
					oldInstance.typeName = i.typeName;
				return oldInstance;
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	/*
		args has the following fields: path, fields, done, fail
	 */
	CRP.prototype.getData = function(args)
	{
		if (typeof(args.done) != "function")
			throw "done is not a function";
		if (typeof(args.fail) != "function")
			throw "fail is not a function";
		if (!args.path)
			throw "path is not defined";
		var _this = this;
		this.queue.add(
			function() {
				if (args.path in _this.paths)
					args.done(_this.paths[args.path]);
				else
				{
					cr.getData({path: args.path, 
								start: args.start,
								end: args.end,
								fields: args.fields,
								done: function(newInstances) {
											var mappedInstances = newInstances.map(function(i) { return crp.pushInstance(i); });
											_this.paths[args.path] = mappedInstances;
											args.done(mappedInstances);
											_this.queue.next();
										}, 
								fail: args.fail});
					return false;
				}
			});
	};
	CRP.prototype.getConfiguration = function(ofKindID, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		var _this = this;
		this.queue.add(
			function() {
				if (ofKindID in _this.configurations)
				{
					successFunction(_this.configurations[ofKindID]);
					return true;
				}
				else
				{
					cr.getConfiguration(null, ofKindID,
						function(cells) {
							_this.configurations[ofKindID] = cells;
							successFunction(cells);
							_this.queue.next();
						}, failFunction);
					return false;
				}
			});
	};
	
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
				$(this).on("dataChanged.cr valueAdded.cr valueDeleted.cr", null, parent, parent.checkDescription);
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

		Cell.prototype.newValue = function() {
			throw "newValue must be overwritten by a subclass";
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
	
	ObjectCell.prototype.copyValue = function(oldValue) {
		var newValue = new cr.ObjectValue();
		
		if (oldValue.id)
			newValue.id = oldValue.id;
		newValue.instanceID = oldValue.instanceID;
		newValue.description = oldValue.description;
		if ("privilege" in oldValue)
			newValue.privilege = oldValue.privilege;
		if ("typeName" in oldValue)
			newValue.typeName = oldValue.typeName;
		if (oldValue.cells)
		{
			newValue.importCells(oldValue.cells);
			newValue.isDataLoaded = true;
		}

		return newValue;
	}
	
	ObjectCell.prototype.addValue = function(newValue)
	{
		/* Look for an existing item that is empty. If one is found, then change its data. */
		for (var i = 0; i < this.data.length; ++i)
		{
			var oldData = this.data[i];
			if (!oldData.id && oldData.isEmpty()) {
				oldData.completeUpdate(newValue);
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
				if (d.getValueID())
				{
					/* This case is true if we are picking an object. */
					newData.push({instanceID: d.getValueID()});
				}
				else if ("cells" in d)
				{
					/* This case is true if we are creating an object */
					var newDatum = {};
					d.cells.forEach(function(cell)
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

	/* The success function takes a single argument: the new value being created. */
	ObjectCell.prototype.addObjectValue = function(initialData, successFunction, failFunction)
		{
			if (!failFunction)
				throw ("failFunction is not specified");
			if (!successFunction)
				throw ("successFunction is not specified");
			if (!this.parent.getValueID())
				throw("cell parent does not have an ID")
			var _this = this;
			$.post(cr.urls.addValue, 
					{ path: '#' + this.parent.getValueID(),
					  fieldName: this.field.nameID,
					  valueUUID: initialData.getValueID(),
					  timezoneoffset: new Date().getTimezoneOffset()
					})
				  .done(function(json, textStatus, jqXHR)
					{
						if (json.success) {
							closealert();
							var newData = _this.newValue();
							newData.id = json.id;
							newData.setDescription(initialData.getDescription());
							newData.instanceID = initialData.getValueID();
							_this.addValue(newData);
							successFunction(newData);
						}
						else {
							failFunction(json.error);
						}
					})
				  .fail(function(jqXHR, textStatus, errorThrown)
						{
							cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
						}
					);
		};
		
	function ObjectCell(field) {
		cr.Cell.call(this, field);
	}
	
	return ObjectCell;
})();

cr.CellValue = (function() {
	CellValue.prototype.getDescription = function()
	{ 
		throw "getDescription must be overwritten";
	};
	
	CellValue.prototype.isEmpty = function()
	{
		throw "isEmpty must be overwritten";
	}
	
	CellValue.prototype.clearValue = function()
	{
		throw "clearValue must be overwritten";
	};
	
	CellValue.prototype.triggerDeleteValue = function()
	{
		/* Delete from the cell first, so that other objects know the cell may be empty. */
		if (this.cell)
		    this.cell.deleteValue(this);
		$(this).trigger("valueDeleted.cr", this);
	}
	
	CellValue.prototype.triggerDataChanged = function()
	{
		$(this).trigger("dataChanged.cr", this);
	}
	
	CellValue.prototype.deleteValue = function(done, fail)
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
				this.getValueID() != null)
			{
				/* In this case, this is a root object, so we just need to 
					delete the instance. */
				var jsonArray = { path: "#" + this.getValueID(),
							timezoneoffset: new Date().getTimezoneOffset()
						};
				$.post(cr.urls.deleteInstances, jsonArray)
					.done(function(json, textStatus, jqXHR)
					{
						if (json.success)
						{
							if (done) 
							{
								_this.triggerDeleteValue();
								done(_this);
							}
						}
						else
						{
							fail(json.error);
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
			var jsonArray = { valueID: this.id,
						timezoneoffset: new Date().getTimezoneOffset()
					};
			$.post(cr.urls.deleteValue, jsonArray)
				.done(function(json, textStatus, jqXHR)
				{
					if (json.success)
					{
						if (done) 
						{
							_this.triggerDeleteValue();
							done(_this);
						}
					}
					else
					{
						fail(json.error);
					}
				})
				.fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, fail);
				});
		}
	};
			
	function CellValue() {
		this.id = null; 
		this.cell = null;	/* Initialize the container cell to empty. */
	};
	
	return CellValue;
})();
	
cr.StringValue = (function() {
	StringValue.prototype = new cr.CellValue();

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
				command = {containerUUID: this.cell.parent.getValueID(), 
						   fieldID: this.cell.field.nameID, 
						   text: newValue,
						   index: i};
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
		cr.CellValue.call(this);
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
				command = {containerUUID: this.cell.parent.getValueID(), 
						   fieldID: this.cell.field.nameID, 
						   text: newValue.text, 
						   languageCode: newValue.languageCode,
						   index: i};
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
	ObjectValue.prototype.getDescription = function() { return this.description; };
	ObjectValue.prototype.getValueID = function()
		{ return this.instanceID; };

	ObjectValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		var newValueID = (newValue ? newValue.getValueID() : null);
		var newDescription = (newValue ? newValue.getDescription() : null);

		/* If both are null, then they are equal. */
		if (!newValueID && !this.getValueID())
			return;
		
		var command;
		if (!newValueID)
		{
			if (!this.getValueID())
				return;
			else
				command = {id: this.id};
		}
		else {
			if (this.getValueID() == newValueID)
				return;
			if (this.id)
				command = {id: this.id, instanceID: newValueID, description: newDescription};
			else
				command = {containerUUID: this.cell.parent.getValueID(), 
						   fieldID: this.cell.field.nameID, 
						   instanceID: newValueID,
						   description: newDescription,
						   index: i};
		}
		initialData.push(command);
		sourceObjects.push(this);
	}

	ObjectValue.prototype.updateFromChangeData = function(changeData)
	{
		/* Replace the value completely so that its cells are eliminated and will be
			re-accessed from the server. This handles the case where a value has been added. */
		this.instanceID = changeData.instanceID;
		this.description = changeData.description;
		this.cells = null;
		this.isDataLoaded = false;
	}
	
	ObjectValue.prototype.completeUpdate = function(newData)
	{
		this.id = newData.id;
		this.updateFromChangeData({instanceID: newData.getValueID(), description: newData.getDescription()});
		this.triggerDataChanged();
	}

	ObjectValue.prototype.isEmpty = function()
	{
		return !this.instanceID && !this.cells;
	}

	ObjectValue.prototype.clearValue = function()
	{
		this.instanceID = null; 
		this.description="None";
		this.cells = null;
		this.privilege = null;
	}
	
	ObjectValue.prototype.setDescription = function(newDescription)
	{
		this.description = newDescription.length > 0 ? newDescription : "None";
	}
	
	ObjectValue.prototype.calculateDescription = function()
	{
		if (!("cells" in this))
		{
			if (this.description.length == 0)
				this.description = "None";
		}
		else
		{
			var nameArray = [];
			for (var i = 0; i < this.cells.length; ++i)
			{
				var cell = this.cells[i];
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
			}
			this.setDescription(nameArray.length ? nameArray.join(separator = ' ') : "None");
		}
	}

	ObjectValue.prototype.hasTextDescription = function()
	{
		for (var i = 0; i < this.cells.length; ++i)
		{
			var cell = this.cells[i];
			if (cell.field.descriptorType == "_by text" &&
				cell.data.length > 0)
				return true;
		}
		return false;
	}

	ObjectValue.prototype.getCell = function(name)
	{
		if (this.cells)
			return this.cells.find(function(cell)
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
		
	ObjectValue.prototype.handleContentsChanged = function()
	{
		var oldDescription = this.getDescription();
		this.calculateDescription();
		if (this.getDescription() != oldDescription)
			this.triggerDataChanged();
	}
	
	/* this method is attached to a cell when its contents are changed. */
	ObjectValue.prototype.checkDescription = function(eventObject)
	{
		eventObject.data.handleContentsChanged();
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
		this.cells.push(newCell);
		return newCell;
	}

	ObjectValue.prototype.importCells = function(oldCells)
	{
		this.cells = [];
		for (var j = 0; j < oldCells.length; ++j)
		{
			this.importCell(oldCells[j]);
		}
	}

	ObjectValue.prototype.saveNew = function(initialData, done, fail)
	{
		if (!fail)
			throw ("fail is not specified");
		if (!done)
			throw ("done is not specified");

		var containerCell = this.cell;
		var containerUUID = containerCell.parent ? containerCell.parent.getValueID() : null;
			
		var _this = this;
		cr.createInstance(containerCell.field, containerUUID, initialData, 
			function(newData)
			{
				_this.completeUpdate(newData);
				_this.isDataLoaded = true;
				done(newData);
			}, 
			fail);
	}
	
	ObjectValue.prototype._setCells = function(oldCells)
	{
		this.cells = oldCells;
		oldCells.forEach(function(cell) {
			cell.setParent(this);
		});
	}
	
	/* Get all of the data associated with the sub-objects in the specified field */
	ObjectValue.prototype.getCellData = function(fieldName, done, fail)
	{
		if (typeof(done) != "function")
			throw "done is not a function";
		if (typeof(fail) != "function")
			throw "fail is not a function";
		if (!this.getValueID())
			throw "this item is not saved";
		if (!fieldName)
			throw "fieldName is not specified";
		
		var _this = this;
	
		crp.queue.add(
			function() {
				var cell = _this.getCell(fieldName);
				if (cell != null)
					done(cell.data);
				else
				{
					var jsonArray = { "path" : "#" + _this.getValueID(),
									  "fieldName" : fieldName };
					$.getJSON(cr.urls.getCellData,
						jsonArray, 
						function(json)
						{
							if (json.success) {
								try
								{
									field = {capacity: "_multiple values", name: fieldName, dataType: "_object"};
									var oldCell = {field: field, data: json.objects};
									if (!_this.cells)
										_this.cells = [];
									cell = _this.importCell(oldCell);
								
									done(cell.data);
									crp.queue.next();
								}
								catch (err)
								{
									fail(err);
								}
							}
							else {
								fail(json.error);
							}
						}
					);
					return false;
				}
			});
	}

	ObjectValue.prototype.checkCells = function(fields, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		if (this.privilege == "_find")
		{
			failFunction("You do not have permission to see information about {0}".format(this.getDescription()));
			return;
		}
	
		if (this.cells && this.isDataLoaded)
		{
			successFunction();
		}
		else if (this.getValueID())
		{
			var _this = this;
			var jsonArray = { "path" : "#" + this.getValueID() };
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields);
			$.getJSON(cr.urls.getData,
				jsonArray, 
				function(json)
				{
					try {
						if (json.success) {
							/* If the data length is 0, then this item can not be read. */
							if (json.data.length > 0)
							{
								var src = json.data[0];
								_this.importCells(src.cells);
								_this.privilege = src.privilege;
								if (src.typeName)
									_this.typeName = src.typeName;
							}
							else
							{
								_this.importCells([]);
								_this.privilege = null;
							}
							_this.isDataLoaded = true;
							successFunction();
						}
						else {
							failFunction(json.error);
						}
					}
					catch (err)
					{
						failFunction(err);
					}
				}
			);
		}
		else if (this.cell.field.ofKindID)
		{
			var _this = this;
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			cr.getConfiguration(this, this.cell.field.ofKindID, 
				function(newCells)
				{
					_this.cells = newCells;
					successFunction();
				},
				failFunction);
		}
	}

	ObjectValue.prototype.checkConfiguration = function(successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		if (!this.cell)
			throw "cell is not specified for this object";
		
		if (this.cells)
		{
			successFunction();
		}
		else
		{
			var _this = this;
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			cr.getConfiguration(this, this.cell.field.ofKindID, 
				function(newCells)
				{
					_this.cells = newCells;
					successFunction();
				},
				failFunction);
		}
	}
	
	ObjectValue.prototype.canWrite = function()
	{
		if (this.getValueID() === null)
			throw(this.getDescription() + " has not been saved");
		if (this.privilege === undefined)
			throw(this.getDescription() + " privilege is not specified");
			
		return ["_write", "_administer"].indexOf(this.privilege) >= 0;
	}
	
	function ObjectValue() {
		cr.CellValue.call(this);
		this.instanceID = null;
		this.description = "None";
		this.isDataLoaded = false;
	};
	
	return ObjectValue;
})();

cr.signedinUser = new cr.ObjectValue();

cr.createSignedinUser = function(instanceID, description)
{
	cr.signedinUser.instanceID = instanceID;
	cr.signedinUser.setDescription(description);
	crp.pushCheckCells(cr.signedinUser, ["_system access"], function()
		{
			cr.signedinUser = crp.pushInstance(cr.signedinUser);
			$(cr.signedinUser).trigger("signin.cr");
		}, asyncFailFunction);
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
	return new f(field)
};
	
cr.urls = {
		selectAll : "/api/selectall/",
		getValues : "/api/getvalues/",
		getUserID : "/api/getuserid/",
		getData : "/api/getdata/",
		getCellData : "/api/getcelldata/",
		getConfiguration : "/api/getconfiguration/",
		createInstance : "/api/createinstance/",
		addValue : "/api/addvalue/",
		updateValues : "/api/updatevalues/",
		deleteValue : '/api/deletevalue/',
		deleteInstances : '/api/deleteinstances/',
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignout: '/user/submitsignout/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
		updateUsername: '/user/updateusername/',
		updatePassword: '/user/updatepassword/',
		log: '/monitor/log/',
	};
	
cr.accessToken = null;
cr.refreshToken = null;
cr.tokenType = null;
	
cr.postFailed = function(jqXHR, textStatus, errorThrown, failFunction)
	{
		if (textStatus == "timeout")
			failFunction("This operation ran out of time. Try again.")
		else
			failFunction("Connection error " + errorThrown + ": " + jqXHR.status + "; " + jqXHR.statusText)
	};
	
	/* args is an object with up to five parameters: path, start, end, done, fail */
cr.selectAll = function(args)
	{
		if (!args.fail)
			throw ("failFunction is not specified");
		if (!args.done)
			throw ("done function is not specified");
		if (!args.path)
			throw "path was not specified to selectAll"

		var data = {path : args.path};
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
		
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		$.getJSON(cr.urls.selectAll, data,
			function(json)
			{
				if (json.success) {
					try
					{
						var instances = json.objects.map(cr.ObjectCell.prototype.copyValue);
						args.done(instances);
					}
					catch(err)
					{
						args.fail(err);
					}
				}
				else {
					args.fail(json.error);
				}
			}
		)
		.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, args.fail);
					}
				);
	};
	
	/* args is an object with up to five parameters: path, start, end, done, fail.
		The done method takes a single argument, which is an array of value objects. */
cr.getValues = function (args)
	{
		if (!args.fail)
			throw ("fail is not specified");
		if (!args.done)
			throw ("done is not specified");
		var argList = {};
		if (args.path)
			argList.path = args.path;
		else
			throw "path was not specified to getValues"
			
		if (args.field)
			argList.fieldName = args.field;
		else
			throw "field was not specified to getValues"
			
		if (args.value)
			argList.value = args.value;
		else
			throw "value was not specified to getValues"
			
		if (args.start !== undefined)
			argList.start = args.start;
		if (args.end !== undefined)
			argList.end = args.end;
		
		$.getJSON(cr.urls.getValues, 
			argList,
			function(json)
			{
				if (json.success) {
					try
					{
						var newObjects = json.objects.map(function(v)
						{
							return cr.ObjectCell.prototype.copyValue(v);
						});
					
						args.done(newObjects);
					}
					catch(err)
					{
						args.fail(err);
					}
				}
				else
				{
					args.fail(json.error);
				}
			}
		);
	};
	
/* The success function takes a single argument: the id of the new value being created. */
cr.addObjectValue = function(containerPath, fieldName, initialData, done, fail)
	{
		if (!fail)
			throw ("fail is not specified");
		if (!done)
			throw ("done is not specified");
		if (!fieldName || fieldName.length == 0)
			throw("fieldName is not specified")
		if (!containerPath || containerPath.length == 0)
			throw("containerPath is not specified")
		var _this = this;
		$.post(cr.urls.addValue, 
				{ path: containerPath,
				  fieldName: fieldName,
				  valueUUID: initialData.getValueID(),
				  timezoneoffset: new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						done(json.id);
					}
					else {
						fail(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, fail);
					}
				);
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
				{ commands: JSON.stringify(initialData),
				  timezoneoffset: new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						oldValue.id = json.valueIDs[0];
						oldValue.updateFromChangeData(d);
						oldValue.triggerDataChanged();
						successFunction();
					}
					else {
						failFunction(json.error);
					}
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
			
		var jsonArray = { valueID: valueID,
					timezoneoffset: new Date().getTimezoneOffset()
				};
		$.post(cr.urls.deleteValue, jsonArray)
			.done(function(json, textStatus, jqXHR)
			{
				if (json.success)
					successFunction(valueID);
				else
					failFunction(json.error);
			})
			.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			});
	};
			
cr.createInstance = function(field, containerUUID, initialData, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		var jsonArray = {
					properties: JSON.stringify(initialData),
					timezoneoffset: new Date().getTimezoneOffset()
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
	
		$.post(cr.urls.createInstance, 
				jsonArray)
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success)
					{
						try
						{
							if (successFunction) 
							{
								/* Copy the data from json object into newData so that 
									any functions are properly initialized.
								 */
								var newData = new cr.ObjectValue();
								/* If there is a container, then the id in newData will contain
									the id of the value object in the database. */
								if (containerUUID)
									newData.id = json.object.id;
								newData.instanceID = json.object.instanceID;
								newData.setDescription(json.object.description);
								successFunction(newData);
							}
						}
						catch(err)
						{
							failFunction(err);
						}
					}
					else
					{
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
	
cr.updateValues = function(initialData, sourceObjects, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.post(cr.urls.updateValues, 
			{ commands: JSON.stringify(initialData),
			  timezoneoffset: new Date().getTimezoneOffset()
			})
		  .done(function(json, textStatus, jqXHR)
			{
				if (json.success) {
					for (var i = 0; i < sourceObjects.length; ++i)
					{
						d = sourceObjects[i];
						newValueID = json.valueIDs[i];
						newInstanceID = json.instanceIDs[i];
						if (newValueID)
						{
							d.id = newValueID;
							
							d.updateFromChangeData(initialData[i]);
							
							/* Object Values have an instance ID as well. */
							if (newInstanceID)
								d.instanceID = newInstanceID;
								
							d.triggerDataChanged();
						}
						else
						{
							d.triggerDeleteValue();
						}
					}
					if (successFunction)
						successFunction();
				}
				else
				{
					if (failFunction)
						failFunction(json.error);
				}
			})
		  .fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
				}
			);
	},
	
cr.getUserID = function(successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getUserID,
			{"access_token": cr.accessToken,
			 "timezoneoffset": new Date().getTimezoneOffset()},
			function(json)
			{
				if (json.success)
				{
					successFunction(json.userID);
				}
				else
					failFunction(json.error);
			})
		.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			}
		);
	},

cr.getConfiguration = function(parent, typeID, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getConfiguration,
			{ "typeID" : typeID }, 
			function(json)
			{
				if (json.success)
				{
					var cells = [];
					json.cells.forEach(function(cell)
					{
						var newCell = cr.createCell(cell.field);
						newCell.setup(parent);
						cells.push(newCell);
					});
				
					successFunction(cells);
				}
				else
				{
					failFunction(json.error);
				}
			}
		);
	},
	
	
/* 
	args is an object with up to four parameters: path, fields, done, fail
 */
cr.getData = function(args)
	{
		if (!args.fail)
			throw ("failFunction is not specified");
		if (!args.done)
			throw ("successFunction is not specified");
		if (!args.path)
			throw ("path is not specified to getData");
			
		var data = {path : args.path}
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		$.getJSON(cr.urls.getData, data,
			function(json)
			{
				if (json.success) {
					var instances = json.data.map(cr.ObjectCell.prototype.copyValue);
					try
					{
						args.done(instances);
					}
					catch(err)
					{
						args.fail(err);
					}
				}
				else {
					args.fail(json.error);
				}
			}
		)
		.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, args.fail);
					}
				);
	},
cr.submitSignout = function(done, fail)
	{
		$.post(cr.urls.submitSignout, { csrfmiddlewaretoken: $.cookie("csrftoken") }, 
									function(json){
			if (json['success']) {
				crp.clear();
				done();
			}
			else
				fail(json.error);
		})
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}

cr.updateUsername = function(newUsername, password, done, fail)
	{
		$.post(cr.urls.updateUsername, {newUsername: newUsername, 
										password: password,
										timezoneoffset: new Date().getTimezoneOffset()},
			   function(json) {
					if (json['success']) {
						var v = cr.signedinUser.getValue('_email');
						v.updateFromChangeData({text: newUsername});
						v.triggerDataChanged();
						done();
					}
					else
						fail(json.error);
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
										newPassword: newPassword }, 
									function(json){
			if (json['success']) {
				done();
			}
			else
				fail(json.error);
		})
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}

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
