const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Set view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ensure uploads are served
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Path to blog data (corrected)
const BLOG_DATA_PATH = path.join(__dirname, 'data', 'blogs.json');

// Ensure the blogs.json file exists
if (!fs.existsSync(BLOG_DATA_PATH)) {
  fs.writeFileSync(BLOG_DATA_PATH, JSON.stringify([])); // Initialize as an empty array if file doesn't exist
}

// Blog upload route
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    const { title, content } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = '/uploads/' + req.file.filename;

    // Blog post data
    const blogData = {
      title,
      content,
      imageUrl,
      slug: title.toLowerCase().replace(/\s+/g, '-'),  // Generate a simple slug
      date: new Date().toISOString().split('T')[0],     // Format date as YYYY-MM-DD
    };

    // Read blogs from the file
    const blogs = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf-8') || '[]');

    // Check for existing blog slug to avoid duplicates
    if (blogs.some(blog => blog.slug === blogData.slug)) {
      return res.status(400).json({ error: 'Blog with this title already exists' });
    }

    // Add the new blog post to the array
    blogs.push(blogData);

    // Write updated blogs array to file
    fs.writeFileSync(BLOG_DATA_PATH, JSON.stringify(blogs, null, 2));

    // Return the newly created blog data
    res.json(blogData);
  } catch (error) {
    console.error('Error during upload:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Serve the frontend form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get the list of blogs in JSON format (for /blog-json request)
app.get('/blog-json', (req, res) => {
  fs.readFile(BLOG_DATA_PATH, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read blog data' });
    }
    try {
      const blogs = JSON.parse(data);
      res.json(blogs);  // Send the blog data as JSON
    } catch (e) {
      res.status(500).json({ error: 'Error parsing blog data' });
    }
  });
});

// Blog collection (view list of blogs)
app.get('/blog', (req, res) => {
  try {
    const blogs = JSON.parse(fs.readFileSync(BLOG_DATA_PATH));
    res.send(`
      <h1>Blog Posts</h1>
      <ul>
        ${blogs.map(b => `<li><a href="/blog/${b.slug}">${b.title}</a> (${b.date})</li>`).join('')}
      </ul>
    `);
  } catch (error) {
    res.status(500).send('Error loading blog posts');
  }
});

// View a single blog post
app.get('/blog/:slug', (req, res) => {
  try {
    const blogs = JSON.parse(fs.readFileSync(BLOG_DATA_PATH));
    const blog = blogs.find(b => b.slug === req.params.slug);

    if (!blog) {
      return res.status(404).send('Blog not found');
    }

    res.send(`
      <h1>${blog.title}</h1>
      <img src="${blog.imageUrl}" width="300" />
      <div>${blog.content}</div>
      <p><i>Published on ${blog.date}</i></p>
      <a href="/blog">← Back to blog</a>
    `);
  } catch (error) {
    res.status(500).send('Error displaying blog post');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
