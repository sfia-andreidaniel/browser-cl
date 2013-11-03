DROP DATABASE IF EXISTS transcoder;

CREATE DATABASE transcoder;

USE transcoder;

DELIMITER ;

CREATE TABLE `uploads` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL DEFAULT '0',
  `storage_address` char(64) NOT NULL DEFAULT '',
  `storage_path` char(255) NOT NULL DEFAULT '',
  `storage_file` char(255) NOT NULL DEFAULT '',
  `storage_http` char(64) NOT NULL DEFAULT '',
  `upload_date` bigint(20) NOT NULL DEFAULT '0',
  `upload_ip` char(15) NOT NULL DEFAULT '0.0.0.0',
  `jobs_completed` int(11) NOT NULL DEFAULT '0',
  `jobs_errors` int(11) NOT NULL DEFAULT '0',
  `jobs_success` int(11) NOT NULL DEFAULT '0',
  `jobs_total` int(11) NOT NULL DEFAULT '0',
  `file_size` bigint(20) NOT NULL DEFAULT '0',
  `total_size` bigint(20) NOT NULL DEFAULT '0',
  `mime` char(32) NOT NULL DEFAULT 'application/octet-stream',
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE `uploads_tasks` (
  `id`                  bigint(20)      NOT NULL AUTO_INCREMENT,
  `status`              enum('new','started','error','success') NOT NULL DEFAULT 'new',
  `started_date`        bigint(20)      NOT NULL DEFAULT '0',
  `ended_date`          bigint(20)      NOT NULL DEFAULT '0',
  `upload_id`           bigint(20)      NOT NULL DEFAULT '0',
  `task_type`           enum('video','audio','image') DEFAULT NULL,
  `task_preset`         char(32)        NOT NULL DEFAULT '',
  `task_size`           bigint(20)      NOT NULL DEFAULT '0',
  `task_extension`      char(32)        NOT NULL DEFAULT '',
  `task_priority`       int(11)         NOT NULL DEFAULT '0',
  `task_started_by`     varchar(64)     NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `status` (`status`),
  KEY `upload_id` (`upload_id`),
  KEY `task_type` (`task_type`),
  KEY `task_preset` (`task_preset`),
  KEY `task_priority` (`task_priority`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE `access` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(32) NOT NULL DEFAULT '',
  `description` char(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

DELIMITER |

CREATE TRIGGER update_status_jobs BEFORE UPDATE ON uploads_tasks
FOR EACH ROW BEGIN
    
    CASE Old.status
        WHEN 'new' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                END; -- new - new --
                
                WHEN 'started' THEN BEGIN
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- new - started --
                
                WHEN 'error' THEN BEGIN
                    UPDATE uploads SET jobs_errors = jobs_errors + 1, jobs_completed = jobs_completed + 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- new - error --
                
                WHEN 'success' THEN BEGIN
                    UPDATE uploads SET jobs_success = jobs_success + 1, jobs_completed = jobs_completed + 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- new - success --
                
            END CASE;
            
        END;
        
        WHEN 'started' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                END; -- started - new --
                
                WHEN 'started' THEN BEGIN
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- started - started --
                
                WHEN 'error' THEN BEGIN
                    UPDATE uploads SET jobs_errors = jobs_errors + 1, jobs_completed = jobs_completed + 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- started - error --
                
                WHEN 'success' THEN BEGIN
                    UPDATE uploads SET jobs_success = jobs_success + 1, jobs_completed = jobs_completed + 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- started - success --
                
            END CASE;
            
        END;
        
        WHEN 'error' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    UPDATE uploads SET jobs_errors = jobs_errors - 1, jobs_completed = jobs_completed - 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                END; -- error - new --
                
                WHEN 'started' THEN BEGIN
                    UPDATE uploads SET jobs_errors = jobs_errors - 1, jobs_completed = jobs_completed - 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- error - started --
                
                WHEN 'error' THEN BEGIN
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- error - error --
                
                WHEN 'success' THEN BEGIN
                    UPDATE uploads SET jobs_errors = jobs_errors - 1, jobs_success = jobs_success - 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- error - success --
                
            END CASE;
            
        END;
        
        WHEN 'success' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    UPDATE uploads SET jobs_success = jobs_success - 1, jobs_completed = jobs_completed - 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                END; -- success - new --
                
                WHEN 'started' THEN BEGIN
                    UPDATE uploads SET jobs_success = jobs_success - 1, jobs_completed = jobs_completed - 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- success - started --
                
                WHEN 'error' THEN BEGIN
                    UPDATE uploads SET jobs_success = jobs_success - 1, jobs_errors = jobs_errors + 1 WHERE uploads.id = New.upload_id LIMIT 1;
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- success - error --
                
                WHEN 'success' THEN BEGIN
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- success - success --
                
            END CASE;
            
        END;
        
    END CASE;
    
END|

DELIMITER ;