const Transaction = require('../models/Transaction');
const Block = require('../models/Block');
const { Block: BlockClass, blockchain } = require('../blockchain/proofofWork');
const crypto = require('crypto');

/**
 * Helper function untuk menghitung hash block
 */
function calculateBlockHash(block) {
  const str = block.index.toString() + block.nonce + JSON.stringify(block.data) + block.previousHash;
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Helper function untuk memproses dan memvalidasi items
 */
function processTransactionItems(items, transaction = null) {
  console.log('=== PROCESSING TRANSACTION ITEMS ===');
  console.log('Raw items received:', JSON.stringify(items, null, 2));
  console.log('Transaction object:', transaction ? {
    id: transaction._id,
    offer: transaction.offer,
    request: transaction.request,
    totalAmount: transaction.totalAmount
  } : 'No transaction object');

  if (!Array.isArray(items) || items.length === 0) {
    console.log('Items is empty or not an array, trying to extract from transaction...');
    
    // Jika items kosong, coba ambil dari offer atau request
    if (transaction && transaction.offer) {
      console.log('Found offer in transaction:', transaction.offer);
      return [{
        name: transaction.offer.productName || transaction.offer.title || 'Product from Offer',
        token: `TOKEN_${transaction.offer._id}`, // FIXED: Gunakan token (singular)
        tokens: [`TOKEN_${transaction.offer._id}`], // Keep array for internal processing
        quantity: transaction.offer.quantity || 1,
        price: transaction.offer.price || transaction.totalAmount || 0
      }];
    }
    
    if (transaction && transaction.request) {
      console.log('Found request in transaction:', transaction.request);
      return [{
        name: transaction.request.productName || transaction.request.title || 'Product from Request',
        token: `TOKEN_${transaction.request._id}`, // FIXED: Gunakan token (singular)
        tokens: [`TOKEN_${transaction.request._id}`], // Keep array for internal processing
        quantity: transaction.request.quantity || 1,
        price: transaction.totalAmount || 0
      }];
    }
    
    // Fallback: buat item default
    return [{
      name: 'Default Product',
      token: `TOKEN_${Date.now()}`, // FIXED: Gunakan token (singular)
      tokens: [`TOKEN_${Date.now()}`], // Keep array for internal processing
      quantity: 1,
      price: transaction ? transaction.totalAmount || 0 : 0
    }];
  }

  return items.map((item, index) => {
    console.log(`Processing item ${index}:`, item);
    
    // Cek semua kemungkinan field untuk name
    const name = item.name || 
                 item.productName || 
                 item.title || 
                 item.itemName ||
                 item.description ||
                 `Product ${index + 1}`;

    // Process tokens array dan ambil token pertama untuk field token
    let tokens = [];
    let primaryToken = '';
    
    if (Array.isArray(item.tokens) && item.tokens.length > 0) {
      tokens = item.tokens;
      primaryToken = item.tokens[0]; // Ambil token pertama sebagai primary token
      console.log(`Found ${tokens.length} tokens for item ${index}:`, tokens);
    } else if (item.token) {
      primaryToken = item.token;
      tokens = [item.token];
    } else if (item.productToken) {
      primaryToken = item.productToken;
      tokens = [item.productToken];
    } else if (item.sku) {
      primaryToken = item.sku;
      tokens = [item.sku];
    } else if (item.productId) {
      primaryToken = item.productId;
      tokens = [item.productId];
    } else if (item.id) {
      primaryToken = item.id;
      tokens = [item.id];
    } else {
      // Generate token default
      primaryToken = `TOKEN${Date.now()}_${index}`;
      tokens = [primaryToken];
    }

    // Cek quantity dan price
    const quantity = parseInt(item.quantity) || 
                     parseInt(item.qty) || 
                     parseInt(item.amount) ||
                     1;

    const price = parseFloat(item.price) || 
                  parseFloat(item.unitPrice) || 
                  parseFloat(item.cost) ||
                  parseFloat(item.value) ||
                  0;

    const processedItem = {
      name,
      token: primaryToken, // FIXED: Tambahkan field token (singular) untuk schema
      tokens, // Keep array untuk processing internal
      quantity,
      price
    };

    console.log(`Processed item ${index}:`, processedItem);
    console.log(`Item ${index} has primary token: ${primaryToken} and ${tokens.length} total tokens`);
    return processedItem;
  });
}

/**
 * Helper function untuk validasi data transaksi
 */
function validateTransactionData(transaction) {
  const errors = [];

  if (!transaction.buyer || !transaction.buyer.email) {
    errors.push('Data buyer tidak lengkap');
  }

  if (!transaction.vendor || !transaction.vendor.email) {
    errors.push('Data vendor tidak lengkap');
  }

  if (!transaction.items || !Array.isArray(transaction.items) || transaction.items.length === 0) {
    errors.push('Items transaksi kosong atau tidak valid');
  }

  if (!transaction.totalAmount || transaction.totalAmount <= 0) {
    errors.push('Total amount tidak valid');
  }

  return errors;
}

/**
 * Record transaction to blockchain
 */
exports.recordToBlockchain = async (req, res) => {
  const { transactionId } = req.params;

  try {
    console.log(`Starting blockchain recording for transaction: ${transactionId}`);

    // Fetch transaction with all required data
    const transaction = await Transaction.findById(transactionId)
      .populate('buyer', 'email name')
      .populate('vendor', 'email name')
      .populate('request')
      .populate('offer');

    if (!transaction) {
      return res.status(404).json({ 
        message: 'Transaksi tidak ditemukan',
        success: false 
      });
    }

    console.log('Transaction data:', JSON.stringify(transaction, null, 2));

    if (transaction.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Transaksi belum selesai dan tidak dapat dicatat ke blockchain',
        success: false,
        currentStatus: transaction.status
      });
    }

    // Check if transaction already exists in blockchain
    const existingBlock = await Block.findOne({ 'data.transactionId': transactionId });
    if (existingBlock) {
      return res.status(400).json({ 
        message: 'Transaksi sudah tercatat di blockchain',
        success: false,
        existingBlock: existingBlock.index
      });
    }

    // Validate transaction data
    const validationErrors = validateTransactionData(transaction);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Data transaksi tidak valid',
        success: false,
        errors: validationErrors
      });
    }

    // Process transaction items
    const processedItems = processTransactionItems(transaction.items, transaction);
    console.log('Final processed items:', JSON.stringify(processedItems, null, 2));

    // Hitung total tokens untuk logging
    const totalTokens = processedItems.reduce((sum, item) => sum + (item.tokens ? item.tokens.length : 0), 0);
    console.log(`Total tokens across all items: ${totalTokens}`);

    // Calculate total from items if not available
    const calculatedTotal = processedItems.reduce((sum, item) => 
      sum + (item.quantity * item.price), 0
    );

    const blockData = {
      transactionId: transaction._id.toString(),
      buyer: transaction.buyer.email,
      vendor: transaction.vendor.email,
      items: processedItems.map(item => ({
        name: item.name,
        token: item.token, // FIXED: Gunakan token (singular) untuk schema
        tokens: item.tokens, // Keep tokens array untuk data lengkap
        quantity: item.quantity,
        price: item.price
      })),
      total: transaction.totalAmount || calculatedTotal,
      timestamp: new Date().toISOString(),
      buyerName: transaction.buyer.name,
      vendorName: transaction.vendor.name
    };

    console.log('Block data prepared:', JSON.stringify(blockData, null, 2));
    console.log('Block data size:', JSON.stringify(blockData).length, 'bytes');

    // Get latest block from database
    const latestBlock = await Block.findOne().sort({ index: -1 });
    const blockIndex = latestBlock ? latestBlock.index + 1 : 1;
    const previousHash = latestBlock ? latestBlock.hash : '0'.repeat(64);

    console.log(`Creating block #${blockIndex} with previous hash: ${previousHash}`);

    // Create new block using BlockClass
    const newBlockClass = new BlockClass(
      blockIndex - 1, // BlockClass uses index - 1
      new Date().toISOString(),
      blockData,
      previousHash
    );
    
    // Mine block with difficulty 3
    console.log('Starting mining process...');
    const miningStartTime = Date.now();
    newBlockClass.mineBlock(3);
    const miningTime = Date.now() - miningStartTime;
    console.log(`Mining completed in ${miningTime}ms with nonce: ${newBlockClass.nonce}`);

    // Save to database
    const newBlock = new Block({
      index: blockIndex,
      timestamp: newBlockClass.timestamp,
      data: blockData,
      previousHash: newBlockClass.previousHash,
      nonce: newBlockClass.nonce,
      hash: newBlockClass.hash
    });

    await newBlock.save();
    console.log(`Block #${blockIndex} saved to database`);

    res.status(201).json({
      message: 'Transaksi berhasil dicatat ke blockchain',
      success: true,
      block: {
        index: newBlock.index,
        hash: newBlock.hash,
        nonce: newBlock.nonce,
        timestamp: newBlock.timestamp,
        dataSize: JSON.stringify(blockData).length,
        miningTime: miningTime
      },
      transactionData: {
        id: transaction._id,
        itemCount: processedItems.length,
        totalTokens: totalTokens,
        totalAmount: blockData.total
      }
    });

  } catch (err) {
    console.error('Error recording to blockchain:', err);
    res.status(500).json({ 
      message: 'Internal server error saat merekam ke blockchain',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Get complete blockchain
 */
exports.getBlockchain = async (req, res) => {
  try {
    console.log('Fetching complete blockchain...');

    const blocks = await Block.find()
      .sort({ index: 1 })
      .lean(); // Use lean() for better performance

    // Patch: Fetch full tokens array from transaction if available
    const transactionMap = {};
    for (const block of blocks) {
      if (block.data && block.data.transactionId) {
        // Only fetch each transaction once
        if (!transactionMap[block.data.transactionId]) {
          const tx = await Transaction.findById(block.data.transactionId).lean();
          transactionMap[block.data.transactionId] = tx;
        }
      }
    }

    // Process blocks to ensure data consistency
    const processedBlocks = blocks.map(block => {
      if (block.data && block.data.items) {
        // If we have the original transaction, use its tokens array
        let tx = null;
        if (block.data.transactionId && transactionMap[block.data.transactionId]) {
          tx = transactionMap[block.data.transactionId];
        }
        block.data.items = block.data.items.map((item, idx) => {
          let tokens = Array.isArray(item.tokens) ? item.tokens : (item.token ? [item.token] : ['NO_TOKEN']);
          // If transaction exists and has items, use its tokens array for this item
          if (tx && tx.items && tx.items[idx] && Array.isArray(tx.items[idx].tokens)) {
            tokens = tx.items[idx].tokens;
          }
          return {
            name: item.name || 'Unknown Product',
            token: tokens[0] || item.token || 'NO_TOKEN',
            tokens: tokens,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price) || 0
          };
        });
      } else if (block.data) {
        block.data.items = [];
      }
      return block;
    });

    console.log(`Blockchain fetched: ${processedBlocks.length} blocks`);

    res.json({ 
      success: true,
      length: processedBlocks.length, 
      chain: processedBlocks,
      lastBlock: processedBlocks.length > 0 ? {
        index: processedBlocks[processedBlocks.length - 1].index,
        hash: processedBlocks[processedBlocks.length - 1].hash,
        timestamp: processedBlocks[processedBlocks.length - 1].timestamp
      } : null
    });

  } catch (err) {
    console.error('Error getting blockchain:', err);
    res.status(500).json({ 
      message: 'Error mengambil data blockchain',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Get block by ID
 */
exports.getBlockById = async (req, res) => {
  try {
    const { blockId } = req.params;

    if (!blockId || !blockId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        message: 'Block ID tidak valid',
        success: false 
      });
    }

    const block = await Block.findById(blockId).lean();
    
    if (!block) {
      return res.status(404).json({ 
        message: 'Block tidak ditemukan',
        success: false 
      });
    }

    console.log('Block data:', JSON.stringify(block.data, null, 2));

    res.json({
      success: true,
      block: block
    });

  } catch (err) {
    console.error('Error getting block by ID:', err);
    res.status(500).json({ 
      message: 'Error mengambil data block',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Get block by index
 */
exports.getBlockByIndex = async (req, res) => {
  try {
    const { index } = req.params;
    const blockIndex = parseInt(index);

    if (isNaN(blockIndex) || blockIndex < 0) {
      return res.status(400).json({ 
        message: 'Index block tidak valid',
        success: false 
      });
    }

    const block = await Block.findOne({ index: blockIndex }).lean();
    
    if (!block) {
      return res.status(404).json({ 
        message: `Block dengan index ${blockIndex} tidak ditemukan`,
        success: false 
      });
    }

    console.log('Block data by index:', JSON.stringify(block.data, null, 2));

    res.json({
      success: true,
      block: block
    });

  } catch (err) {
    console.error('Error getting block by index:', err);
    res.status(500).json({ 
      message: 'Error mengambil data block',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Validate entire blockchain
 */
exports.validateBlockchain = async (req, res) => {
  try {
    console.log('Starting blockchain validation...');

    const blocks = await Block.find().sort({ index: 1 }).lean();
    
    if (blocks.length === 0) {
      return res.json({
        isValid: true,
        message: 'Blockchain kosong, validasi berhasil',
        success: true,
        errors: [],
        blockCount: 0
      });
    }

    let isValid = true;
    let errors = [];
    let warnings = [];

    for (let i = 0; i < blocks.length; i++) {
      const currentBlock = blocks[i];
      
      // Validate block structure
      if (typeof currentBlock.index !== 'number') {
        isValid = false;
        errors.push(`Block ${i}: Index tidak valid`);
      }

      if (!currentBlock.hash || typeof currentBlock.hash !== 'string') {
        isValid = false;
        errors.push(`Block ${i}: Hash tidak valid`);
      }

      if (!currentBlock.timestamp) {
        warnings.push(`Block ${i}: Timestamp kosong`);
      }

      // Validate hash calculation
      try {
        const calculatedHash = calculateBlockHash(currentBlock);
        if (currentBlock.hash !== calculatedHash) {
          isValid = false;
          errors.push(`Block ${currentBlock.index}: Hash tidak sesuai (Expected: ${calculatedHash}, Got: ${currentBlock.hash})`);
        }
      } catch (hashError) {
        isValid = false;
        errors.push(`Block ${currentBlock.index}: Error menghitung hash - ${hashError.message}`);
      }

      // Validate proof of work (3 leading zeros)
      if (!currentBlock.hash.startsWith('000')) {
        isValid = false;
        errors.push(`Block ${currentBlock.index}: Hash tidak memenuhi difficulty requirement (3 leading zeros)`);
      }

      // Validate previous hash (except for first block)
      if (i > 0) {
        const previousBlock = blocks[i - 1];
        if (currentBlock.previousHash !== previousBlock.hash) {
          isValid = false;
          errors.push(`Block ${currentBlock.index}: Previous hash tidak cocok dengan block sebelumnya`);
        }
      } else {
        // First block should have previousHash of all zeros or empty
        if (currentBlock.previousHash && currentBlock.previousHash !== '0'.repeat(64)) {
          warnings.push(`Block ${currentBlock.index}: First block memiliki previousHash yang tidak standar`);
        }
      }

      // Validate data structure dan tokens
      if (!currentBlock.data) {
        warnings.push(`Block ${currentBlock.index}: Data block kosong`);
      } else {
        if (currentBlock.data.items && !Array.isArray(currentBlock.data.items)) {
          warnings.push(`Block ${currentBlock.index}: Items bukan array`);
        } else if (currentBlock.data.items) {
          // Validasi struktur tokens dalam setiap item
          currentBlock.data.items.forEach((item, itemIndex) => {
            // FIXED: Validasi token field yang required
            if (!item.token) {
              warnings.push(`Block ${currentBlock.index}, Item ${itemIndex}: Token field kosong`);
            }
            if (!Array.isArray(item.tokens)) {
              warnings.push(`Block ${currentBlock.index}, Item ${itemIndex}: Tokens bukan array`);
            } else if (item.tokens.length === 0) {
              warnings.push(`Block ${currentBlock.index}, Item ${itemIndex}: Tokens array kosong`);
            }
          });
        }
      }
    }

    console.log(`Blockchain validation completed. Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);

    res.json({
      isValid,
      success: true,
      errors,
      warnings,
      message: isValid ? 'Blockchain valid' : 'Blockchain tidak valid',
      blockCount: blocks.length,
      validationTime: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error validating blockchain:', err);
    res.status(500).json({ 
      message: 'Error validasi blockchain',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Get mining steps for a transaction (simulation)
 */
exports.getMiningSteps = async (req, res) => {
  const { transactionId } = req.params;

  try {
    console.log(`Getting mining steps for transaction: ${transactionId}`);

    const transaction = await Transaction.findById(transactionId)
      .populate('buyer', 'email name')
      .populate('vendor', 'email name');

    if (!transaction) {
      return res.status(404).json({ 
        message: 'Transaksi tidak ditemukan',
        success: false 
      });
    }

    if (transaction.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Transaksi belum selesai',
        success: false,
        currentStatus: transaction.status
      });
    }

    // Process transaction data
    const processedItems = processTransactionItems(transaction.items, transaction);
    const blockData = {
      transactionId: transaction._id.toString(),
      buyer: transaction.buyer.email,
      vendor: transaction.vendor.email,
      items: processedItems,
      total: transaction.totalAmount,
      timestamp: new Date().toISOString()
    };

    // Get latest block info
    const latestBlock = await Block.findOne().sort({ index: -1 });
    const blockIndex = latestBlock ? latestBlock.index + 1 : 1;
    const previousHash = latestBlock ? latestBlock.hash : '0'.repeat(64);

    const block = new BlockClass(
      blockIndex - 1,
      new Date().toISOString(),
      blockData,
      previousHash
    );

    let steps = [];
    let nonce = 0;
    let hash = block.calculateHash();
    const difficulty = 3;
    const target = '0'.repeat(difficulty);

    console.log('Simulating mining process...');

    // Mining simulation with step tracking
    while (!hash.startsWith(target) && nonce < 100000) { // Prevent infinite loop
      if (nonce % 1000 === 0 || steps.length < 10) { // Record every 1000 steps or first 10 steps
        steps.push({
          step: steps.length + 1,
          nonce,
          hash,
          isValid: hash.startsWith(target),
          description: `Attempt ${nonce}: Testing nonce ${nonce}`,
          hashPrefix: hash.substring(0, 10) + '...'
        });
      }

      nonce++;
      block.nonce = nonce;
      hash = block.calculateHash();
    }

    // Add final step
    steps.push({
      step: steps.length + 1,
      nonce,
      hash,
      isValid: hash.startsWith(target),
      description: `✅ Mining completed! Valid hash found at nonce ${nonce}`,
      hashPrefix: hash.substring(0, 10) + '...',
      isFinal: true
    });

    // Hitung total tokens untuk info
    const totalTokens = processedItems.reduce((sum, item) => sum + (item.tokens ? item.tokens.length : 0), 0);

    console.log(`Mining simulation completed in ${nonce} attempts`);
    
    res.json({ 
      message: 'Simulasi mining berhasil',
      success: true,
      steps,
      summary: {
        totalAttempts: nonce,
        difficulty,
        finalNonce: nonce,
        finalHash: hash,
        blockIndex: blockIndex,
        itemCount: processedItems.length,
        totalTokens: totalTokens
      }
    });

  } catch (err) {
    console.error('Error getting mining steps:', err);
    res.status(500).json({ 
      message: 'Error simulasi mining',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Get blockchain statistics
 */
exports.getBlockchainStats = async (req, res) => {
  try {
    const blocks = await Block.find().sort({ index: 1 }).lean();
    
    if (blocks.length === 0) {
      return res.json({
        success: true,
        stats: {
          totalBlocks: 0,
          totalTransactions: 0,
          totalTokens: 0,
          averageMiningTime: 0,
          lastBlockTime: null
        }
      });
    }

    const totalBlocks = blocks.length;
    const totalTransactions = blocks.filter(block => block.data && block.data.transactionId).length;
    
    // Hitung total tokens di seluruh blockchain
    const totalTokens = blocks.reduce((sum, block) => {
      if (block.data && block.data.items) {
        return sum + block.data.items.reduce((itemSum, item) => {
          return itemSum + (Array.isArray(item.tokens) ? item.tokens.length : 1);
        }, 0);
      }
      return sum;
    }, 0);
    
    const lastBlock = blocks[blocks.length - 1];
    
    // Calculate average nonce (approximation of mining difficulty)
    const averageNonce = blocks.reduce((sum, block) => sum + (block.nonce || 0), 0) / totalBlocks;

    res.json({
      success: true,
      stats: {
        totalBlocks,
        totalTransactions,
        totalTokens,
        averageNonce: Math.round(averageNonce),
        lastBlockIndex: lastBlock.index,
        lastBlockHash: lastBlock.hash,
        lastBlockTime: lastBlock.timestamp,
        chainSize: JSON.stringify(blocks).length
      }
    });

  } catch (err) {
    console.error('Error getting blockchain stats:', err);
    res.status(500).json({ 
      message: 'Error mengambil statistik blockchain',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};