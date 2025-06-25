const crypto = require('crypto');

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index + 1;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    // Perubahan struktur data untuk hash: block_id + nonce + data + previous hash
    const str = this.index.toString() + this.nonce + JSON.stringify(this.data) + this.previousHash;
    console.log(str);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  mineBlock(difficulty) {
    while (!this.hash.startsWith('0'.repeat(difficulty))) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

class Blockchain {
  constructor() {
    this.chain = []; // Blockchain dimulai dengan array kosong
    this.difficulty = 3;
  }

  // Metode ini dihapus karena kita tidak lagi menggunakan genesis block
  // createGenesisBlock() {
  //   return new Block(0, new Date().toISOString(), "Genesis Block", "0");
  // }

  getLatestBlock() {
    if (this.chain.length === 0) {
      return null; // Mengembalikan null jika blockchain kosong
    }
    return this.chain[this.chain.length - 1];
  }

  addBlock(newBlock) {
    // Jika blockchain kosong, gunakan previousHash yang terdiri dari 64 angka 0
    if (this.chain.length === 0) {
      newBlock.previousHash = '0'.repeat(64);
    } else {
      newBlock.previousHash = this.getLatestBlock().hash;
    }
    
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
  }

  getAllBlocks() {
    return this.chain;
  }
  
  isEmpty() {
    return this.chain.length === 0;
  }
}

// Ekspor class dan instance-nya
module.exports = {
  Block,
  Blockchain,
  blockchain: new Blockchain()
};
