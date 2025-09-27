CREATE DATABASE  IF NOT EXISTS `vocab_app` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `vocab_app`;
-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: 192.168.0.144    Database: vocab_app
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ai_completion_log`
--

DROP TABLE IF EXISTS `ai_completion_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_completion_log` (
  `log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `v_id` int unsigned DEFAULT NULL,
  `job_type` enum('explain','batch_explain','other') NOT NULL DEFAULT 'explain',
  `model` varchar(64) NOT NULL,
  `request_payload` json NOT NULL,
  `response_payload` json DEFAULT NULL,
  `prompt_tokens` int unsigned DEFAULT NULL,
  `completion_tokens` int unsigned DEFAULT NULL,
  `total_tokens` int unsigned DEFAULT NULL,
  `latency_ms` int unsigned DEFAULT NULL,
  `http_status` int unsigned DEFAULT NULL,
  `status` enum('success','error') NOT NULL,
  `error_message` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_log_v` (`v_id`),
  CONSTRAINT `fk_log_vocab` FOREIGN KEY (`v_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Audit log for every LLM call (prompt/response/tokens/status)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_completion_log`
--

LOCK TABLES `ai_completion_log` WRITE;
/*!40000 ALTER TABLE `ai_completion_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_completion_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_explain_queue`
--

DROP TABLE IF EXISTS `ai_explain_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_explain_queue` (
  `q_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `v_id` int unsigned NOT NULL,
  `priority` tinyint unsigned NOT NULL DEFAULT '5',
  `status` enum('queued','processing','done','error','skipped') NOT NULL DEFAULT 'queued',
  `attempts` tinyint unsigned NOT NULL DEFAULT '0',
  `last_error` text,
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`q_id`),
  UNIQUE KEY `uk_queue_v` (`v_id`),
  CONSTRAINT `fk_queue_vocab` FOREIGN KEY (`v_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Work queue for generating vocabulary explanations via ChatGPT';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_explain_queue`
--

LOCK TABLES `ai_explain_queue` WRITE;
/*!40000 ALTER TABLE `ai_explain_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_explain_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_explain_result`
--

DROP TABLE IF EXISTS `ai_explain_result`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_explain_result` (
  `v_id` int unsigned NOT NULL,
  `explain_text` text NOT NULL,
  `source_model` varchar(64) NOT NULL,
  `model_version` varchar(64) DEFAULT NULL,
  `confidence` tinyint unsigned DEFAULT NULL,
  `is_reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed_by` varchar(128) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`v_id`),
  CONSTRAINT `fk_res_vocab` FOREIGN KEY (`v_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Single source of truth for accepted explanation text per vocabulary';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_explain_result`
--

LOCK TABLES `ai_explain_result` WRITE;
/*!40000 ALTER TABLE `ai_explain_result` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_explain_result` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_feedback`
--

DROP TABLE IF EXISTS `ai_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_feedback` (
  `fb_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `v_id` int unsigned NOT NULL,
  `feedback_type` enum('approve','reject','edit','other') NOT NULL,
  `comment_text` text,
  `suggested_text` text,
  `created_by` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fb_id`),
  KEY `idx_fb_v` (`v_id`),
  CONSTRAINT `fk_fb_vocab` FOREIGN KEY (`v_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Per-item feedback to improve future prompts or for fine-tuning datasets';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_feedback`
--

LOCK TABLES `ai_feedback` WRITE;
/*!40000 ALTER TABLE `ai_feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chapter`
--

DROP TABLE IF EXISTS `chapter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chapter` (
  `c_id` int unsigned NOT NULL AUTO_INCREMENT,
  `c_title` varchar(255) NOT NULL,
  `createdTime` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`c_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Chapters container';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chapter`
--

LOCK TABLES `chapter` WRITE;
/*!40000 ALTER TABLE `chapter` DISABLE KEYS */;
INSERT INTO `chapter` VALUES (1,'Breakfast At Tiffany','2025-09-25 10:43:55');
/*!40000 ALTER TABLE `chapter` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voca_chap`
--

DROP TABLE IF EXISTS `voca_chap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voca_chap` (
  `vc_id` int unsigned NOT NULL AUTO_INCREMENT,
  `v_id` int unsigned NOT NULL,
  `c_id` int unsigned NOT NULL,
  `createdTime` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vc_id`),
  UNIQUE KEY `uk_vocachap_v_c` (`v_id`,`c_id`),
  KEY `idx_vocachap_v` (`v_id`),
  KEY `idx_vocachap_c` (`c_id`),
  CONSTRAINT `fk_vocachap_c` FOREIGN KEY (`c_id`) REFERENCES `chapter` (`c_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_vocachap_v` FOREIGN KEY (`v_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Many-to-many: which vocabulary appears in which chapter';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voca_chap`
--

LOCK TABLES `voca_chap` WRITE;
/*!40000 ALTER TABLE `voca_chap` DISABLE KEYS */;
INSERT INTO `voca_chap` VALUES (1,1,1,'2025-09-25 10:44:20'),(2,3,1,'2025-09-25 10:44:20'),(3,4,1,'2025-09-25 10:44:20'),(4,5,1,'2025-09-25 10:44:20');
/*!40000 ALTER TABLE `voca_chap` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voca_similar`
--

DROP TABLE IF EXISTS `voca_similar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voca_similar` (
  `v1_id` int unsigned NOT NULL,
  `v2_id` int unsigned NOT NULL,
  PRIMARY KEY (`v1_id`,`v2_id`),
  KEY `idx_vocasim_v2` (`v2_id`),
  CONSTRAINT `fk_vocasim_v1` FOREIGN KEY (`v1_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_vocasim_v2` FOREIGN KEY (`v2_id`) REFERENCES `vocabulary` (`v_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Pairs of similar vocabulary terms (unordered; triggers enforce v1_id < v2_id)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voca_similar`
--

LOCK TABLES `voca_similar` WRITE;
/*!40000 ALTER TABLE `voca_similar` DISABLE KEYS */;
INSERT INTO `voca_similar` VALUES (1,6),(1,7),(1,8);
/*!40000 ALTER TABLE `voca_similar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vocabulary`
--

DROP TABLE IF EXISTS `vocabulary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vocabulary` (
  `v_id` int unsigned NOT NULL AUTO_INCREMENT,
  `v_title` varchar(255) NOT NULL,
  `explain` text,
  `status` tinyint unsigned NOT NULL DEFAULT '1',
  `createdTime` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`v_id`),
  UNIQUE KEY `uk_vocabulary_title` (`v_title`),
  CONSTRAINT `chk_vocabulary_status` CHECK ((`status` in (1,2,3)))
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Vocabulary master list';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vocabulary`
--

LOCK TABLES `vocabulary` WRITE;
/*!40000 ALTER TABLE `vocabulary` DISABLE KEYS */;
INSERT INTO `vocabulary` VALUES (1,'Chic',NULL,1,'2025-09-25 10:43:12'),(3,'Cab',NULL,1,'2025-09-25 10:43:35'),(4,'Fare',NULL,1,'2025-09-25 10:43:35'),(5,'Decorator',NULL,1,'2025-09-25 10:43:35'),(6,'stylish',NULL,1,'2025-09-25 10:45:55'),(7,'trendy',NULL,1,'2025-09-25 10:45:55'),(8,'fashionable',NULL,1,'2025-09-25 10:45:55');
/*!40000 ALTER TABLE `vocabulary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'vocab_app'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-25 21:11:12
