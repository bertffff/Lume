
// Система достижений TeleRave
// Проверяет условия и выдаёт ачивки пользователям

import { prisma } from '../db.js';
import type { AchievementInfo } from '../types.js';
import { logger } from '../utils/logger.js';

// Определения всех достижений
export const ACHIEVEMENTS = [
  {
    key: 'first_party',
    title: '🎉 Первая вечеринка',
    description: 'Присоединитесь к первой совместной комнате просмотра',
    icon: '🎉',
    xpReward: 50,
    condition: 'totalParties >= 1',
  },
  {
    key: 'party_animal',
    title: '🦁 Тусовщик',
    description: 'Проведите 10 совместных просмотров',
    icon: '🦁',
    xpReward: 200,
    condition: 'totalParties >= 10',
  },
  {
    key: 'party_legend',
    title: '👑 Легенда вечеринок',
    description: 'Проведите 100 совместных просмотров',
    icon: '👑',
    xpReward: 1000,
    condition: 'totalParties >= 100',
  },
  {
    key: 'night_watch',
    title: '🌙 Ночной дозор',
    description: 'Смотрите видео после полуночи',
    icon: '🌙',
    xpReward: 100,
    condition: 'watchAfterMidnight',
  },
  {
    key: 'marathon',
    title: '🏃 Марафонец',
    description: 'Проведите 5 часов за совместным просмотром',
    icon: '🏃',
    xpReward: 300,
    condition: 'totalWatchTime >= 18000',
  },
  {
    key: 'binge_watcher',
    title: '📺 Запойный зритель',
    description: 'Проведите 24 часа за совместным просмотром',
    icon: '📺',
    xpReward: 500,
    condition: 'totalWatchTime >= 86400',
  },
  {
    key: 'social_butterfly',
    title: '🦋 Душа компании',
    description: 'Отправьте 100 сообщений в чатах',
    icon: '🦋',
    xpReward: 150,
    condition: 'totalMessages >= 100',
  },
  {
    key: 'host_master',
    title: '🎬 Мастер хост',
    description: 'Создайте 10 комнат',
    icon: '🎬',
    xpReward: 250,
    condition: 'roomsCreated >= 10',
  },
  {
    key: 'early_bird',
    title: '🐦 Ранняя пташка',
    description: 'Начните просмотр до 7 утра',
    icon: '🐦',
    xpReward: 100,
    condition: 'watchBeforeSeven',
  },
  {
    key: 'reaction_king',
    title: '😂 Король реакций',
    description: 'Отправьте 50 реакций',
    icon: '😂',
    xpReward: 100,
    condition: 'totalReactions >= 50',
  },
] as const;

/**
 * Инициализация достижений в БД (вызывается при первом запуске)
 */
export async function seedAchievements(): Promise<void> {
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: {
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        condition: achievement.condition,
      },
    });
  }
  logger.info(`${ACHIEVEMENTS.length} achievements loaded`);
}

/**
 * Проверка и выдача достижений пользователю
 * @param userId — ID пользователя
 * @returns Список вновь полученных достижений
 */
export async function checkAchievements(userId: string): Promise<AchievementInfo[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      achievements: { include: { achievement: true } },
    },
    // Используем _count вместо загрузки всех записей (N+1 fix)
  });

  if (!user) return [];

  // Отдельно подсчитываем агрегаты через _count
  const counts = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: { messages: true, reactions: true, ownedRooms: true },
      },
    },
  });

  const unlockedKeys = new Set(user.achievements.map((a) => a.achievement.key));
  const newAchievements: AchievementInfo[] = [];

  const now = new Date();
  const hour = now.getHours();
  const totalMessages = counts?._count.messages ?? 0;
  const totalReactions = counts?._count.reactions ?? 0;
  const roomsCreated = counts?._count.ownedRooms ?? 0;

  // Проверяем каждое достижение
  for (const def of ACHIEVEMENTS) {
    if (unlockedKeys.has(def.key)) continue; // Уже получено

    let earned = false;

    switch (def.key) {
      case 'first_party':
        earned = user.totalParties >= 1;
        break;
      case 'party_animal':
        earned = user.totalParties >= 10;
        break;
      case 'party_legend':
        earned = user.totalParties >= 100;
        break;
      case 'night_watch':
        earned = hour >= 0 && hour < 5;
        break;
      case 'marathon':
        earned = user.totalWatchTime >= 18000;
        break;
      case 'binge_watcher':
        earned = user.totalWatchTime >= 86400;
        break;
      case 'social_butterfly':
        earned = totalMessages >= 100;
        break;
      case 'host_master':
        earned = roomsCreated >= 10;
        break;
      case 'early_bird':
        earned = hour >= 5 && hour < 7;
        break;
      case 'reaction_king':
        earned = totalReactions >= 50;
        break;
    }

    if (earned) {
      // Находим ачивку в БД
      const achievement = await prisma.achievement.findUnique({
        where: { key: def.key },
      });

      if (achievement) {
        // Создаём запись о получении
        await prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });

        // Начисляем XP
        await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: achievement.xpReward } },
        });

        newAchievements.push({
          id: achievement.id,
          key: achievement.key,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          xpReward: achievement.xpReward,
          unlockedAt: new Date().toISOString(),
        });

        logger.info(`${user.displayName} unlocked achievement: ${achievement.title}`);
      }
    }
  }

  // Проверяем повышение уровня (каждые 500 XP)
  if (newAchievements.length > 0) {
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    if (updatedUser) {
      const newLevel = Math.floor(updatedUser.xp / 500) + 1;
      if (newLevel > updatedUser.level) {
        await prisma.user.update({
          where: { id: userId },
          data: { level: newLevel },
        });
        logger.info(`${user.displayName} leveled up to ${newLevel}`);
      }
    }
  }

  return newAchievements;
}


