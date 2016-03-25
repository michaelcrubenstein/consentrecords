
/* Used to chunk getData operations. */
var GetDataChunker = (function() {
	GetDataChunker.prototype.path = null;
	GetDataChunker.prototype.fields = [];
	GetDataChunker.prototype._increment = 50;
	GetDataChunker.prototype._containerNode = null;
	GetDataChunker.prototype._loadingMessage = null;
	GetDataChunker.prototype._isSpinning = null;
	GetDataChunker.prototype._start = 0;
	GetDataChunker.prototype._inGetData = false;
	GetDataChunker.prototype._onGetDataDone = null;
	GetDataChunker.prototype._check = null;
	
	GetDataChunker.prototype._clearScrollCheck = function()
	{
		if (this._check != null)
		{
			$(this._containerNode).off("scroll", this._check);
			$(window).off("resize", this._check);
			this._check = null;
		}
		this._inGetData = false;
	}
	
	GetDataChunker.prototype.clearLoadingMessage = function()
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._loadingMessage.remove();
			this._loadingMessage = null;
			this._isSpinning = false;
		}
		this._clearScrollCheck();
	}
	
	GetDataChunker.prototype._restart = function(instances, startVal)
	{
		if (this._loadingMessage != null)
		{
			if (instances.length < this._increment)
			{
				this.clearLoadingMessage();
				this._start = 0;
			}
			else
			{
				this._start += this._increment;
				if (!this.isOverflowingY(this._loadingMessage.node()))
					this._continue(startVal);
				else
					this._inGetData = false;
			}
		}
	}
	
	GetDataChunker.prototype._doneGetData = function(instances, startVal)
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._isSpinning = false;
		}
		this._onGetDataDone(instances, startVal);
		this._restart(instances, startVal);
	}
	
	GetDataChunker.prototype.showLoadingMessage = function()
	{
		if (this._loadingMessage == null)
		{
			this._loadingMessage = crv.appendLoadingMessage(this._containerNode);
			this._isSpinning = true;
		}
		else if (!this._isSpinning)
		{
			crv.startLoadingMessage(this._loadingMessage);
			this._isSpinning = true;
		}
	}
	
	GetDataChunker.prototype._dataGetter = function()
	{
		return cr.getData;
	}
	
	GetDataChunker.prototype._continue = function(startVal)
	{
		var _this = this;
		
		this.showLoadingMessage();

		this._dataGetter()({path: this.path, 
					start: this._start,
					end: this._start + this._increment,
					fields: this.fields, 
					done: function(instances) { _this._doneGetData(instances, startVal); }, 
					fail: asyncFailFunction});
		this._inGetData = true;
	}
	
	GetDataChunker.prototype.start = function(startVal)
	{
		var _this = this;
		
		this._clearScrollCheck();
		this._start = 0;

		this._check = function()
		{
			_this.onScroll(startVal);
		}
		
		var scrollingNode = this._containerNode.offsetParent;
		$(scrollingNode).scroll(this._check);
		$(window).resize(this._check);
		$(scrollingNode).on("remove", function()
			{
				$(window).off("resize", _this.check);
			});
		this._continue(startVal);
	}
	
	GetDataChunker.prototype.isOverflowingY = function(node)
	{
		var p = node.offsetParent;
		return node.offsetTop > $(p).scrollTop() + $(p).height();
	}
	
	GetDataChunker.prototype.onScroll = function(startVal)
	{
		if (this._loadingMessage != null && !this._inGetData)
		{
			if (!this.isOverflowingY(this._loadingMessage.node()))
				this._continue(startVal);
		}
	}
	
	GetDataChunker.prototype._appendNode = function(elementType)
	{
		var t = document.createElement(elementType);
		if (this._loadingMessage)
    		this._containerNode.insertBefore(t, this._loadingMessage.node());
    	else
    		this._containerNode.appendChild(t);
    	return t;
	}

	GetDataChunker.prototype.appendButtonContainers = function(data)
	{
		var _this = this;
		
		/* Ensure that the container is visible, so that the new items will also appear. */
		$(this._containerNode).css("display", "");
		
		var items = data.map(function(d) {
			var i = _this._appendNode('li');
			d3.select(i).datum(d);
			return i;
		});
		return d3.selectAll(items);
	}
	
	function GetDataChunker(containerNode, onGetDataDone)
	{
		this._containerNode = containerNode;
		this._loadingMessage = null;
		this._isSpinning = false;
		this.path = null;
		this._start = 0;
		this._inGetData = false;
		this._onGetDataDone = onGetDataDone;
		this._check = null;
	}
	
	return GetDataChunker;
})();

var SelectAllChunker = (function() {
	SelectAllChunker.prototype = new GetDataChunker();

	SelectAllChunker.prototype._dataGetter = function()
	{
		return cr.selectAll;
	}
	function SelectAllChunker(containerNode, onGetDataDone)
	{
		GetDataChunker.call(this, containerNode, onGetDataDone);
	}
	return SelectAllChunker;
})();
